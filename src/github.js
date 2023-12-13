const CONSTS = require("./consts");
const core = require("@actions/core");
const github = require("@actions/github");
const { prettyStringify } = require("./utils");
const githubToken = process.env.INPUT_GITHUBTOKENORG;
if (!githubToken) {
  throw new Error("No INPUT_GITHUBTOKENORG Env Set");
}
const octokit = github.getOctokit(githubToken);

const PR_REVIEWS_QUERY = `
query($name: String!, $owner: String!, $pull_number: Int!) {
  repository(name: $name, owner: $owner) {
    pullRequest(number: $pull_number) {
      reviews(last:50) {
        totalCount
        nodes {
          state
          publishedAt
          minimizedReason
          pullRequest{
            commits(last: 1){
              nodes{
                commit {
                    message
                    committedDate
                }
              }
            }
          }
          author {
          login
        }
      }
    }
  }
}
}
`;

const GET_COMMENTS_QUERY = `
query($name: String!, $owner: String!, $pull_number: Int!) {
  repository(name: $name, owner: $owner) {
    pullRequest(number: $pull_number) {
      comments(first:50){
        nodes {
          body
      }
    }
  }
}
}
`;

/**
 *
 * @param {string} repoName repository name
 * @param {string} owner owner of the repository
 * @param {number} prNumber pull request number
 * @returns {Promise<Array<string>>}
 */
async function getPRComments(repoName, owner, prNumber) {
  const prResponse = await octokit.graphql(GET_COMMENTS_QUERY, {
    name: repoName,
    owner,
    pull_number: prNumber,
  });
  if (!prResponse?.pullRequest?.comments?.nodes) {
    const msg =
      "Couldn't get PR Comments" +
      prettyStringify({ repoName, owner, prNumber });
    core.debug(msg);
    throw new Error(msg);
  }
  return prResponse.pullRequest.comments.nodes.map((item) => item.body);
}

function parsePullRequestFromUrl(pr) {
  core.debug("Parsing Pull Request From URL: " + prettyStringify(pr));
  const parsedUrl = pr.url
    .replace("https://github.com/", "")
    .replace(/\/pull.*/, "");
  const splitUrl = parsedUrl.split("/");
  return {
    prNum: pr.number,
    repoName: splitUrl[1],
    owner: splitUrl[0],
  };
}

function getReviewCommentStatus(reviewComment, ignoreTime = false) {
  core.debug(
    "Getting Review Comment Status: IgnoreTime: " +
      ignoreTime +
      "; " +
      prettyStringify(reviewComment)
  );

  if (!reviewComment) {
    return "NA";
  }
  if (
    !ignoreTime &&
    reviewComment?.pullRequest?.commits?.nodes?.[0]?.commit?.committedDate
  ) {
    if (
      new Date(reviewComment.publishedAt).getTime() <
      new Date(
        reviewComment.pullRequest.commits.nodes[0].commit.committedDate
      ).getTime()
    ) {
      return "NA";
    }
  }

  if (reviewComment.state === "APPROVED") {
    return "OK";
  } else {
    return "FAIL";
  }
}

/**
 *
 * @param {import("@actions/github/lib/interfaces").WebhookPayload | undefined} payload
 * @returns
 */
async function getDataFromPR(payload) {
  core.debug("Getting Data From PR: " + prettyStringify(payload));
  if (!payload || !payload.pull_request) {
    throw new Error("No Pull Request in Payload");
  }
  if (!payload || !payload.repository) {
    throw new Error("No Repository in Payload");
  }
  const repoNameSplit = payload.repository.full_name?.split("/") || [];
  const repoName = repoNameSplit[1];
  const repoOwner = repoNameSplit[0];
  if (!repoName || !repoOwner) {
    throw new Error("Couldn't get repo name or owner from payload");
  }
  const comments = await getPRComments(
    repoName,
    repoOwner,
    payload.pull_request.number
  );
  return {
    title: payload.pull_request["title"],
    body: payload.pull_request["body"],
    ref: payload.pull_request["head"]["ref"],
    comments,
  };
}

function getIsLatestCommitWIP(reviewComment) {
  core.debug("Is Latest Commit WIP: " + prettyStringify(reviewComment));

  const message =
    reviewComment?.pullRequest?.commits?.nodes?.[0]?.commit?.message || "";
  let shouldBypass = false;
  for (let i = 0; i < CONSTS.MOVE_TO_FEATURE_QA_COMMIT_BYPASS.length; i++) {
    const term = CONSTS.MOVE_TO_FEATURE_QA_COMMIT_BYPASS[i];
    if (message.toLowerCase().includes(term)) {
      shouldBypass = true;
      break;
    }
  }
  return shouldBypass;
}

async function getStoryGithubStats(storyId, client) {
  core.debug("Getting Story Github Stats: StoryId: " + storyId);
  const story = await client.getStory(storyId);
  let totalBranches = 0;
  let branchesWithOpenPrs = 0;
  const prNumbers = [];
  for (const branch of story.data.branches) {
    if (branch.deleted) {
      continue;
    }
    totalBranches++;
    for (const pr of branch.pull_requests) {
      if (pr.closed === false && pr.merged === false) {
        branchesWithOpenPrs++;
        const parsed = parsePullRequestFromUrl(pr);
        prNumbers.push(parsed);
      }
    }
  }

  const allOpenPrs = await Promise.all(
    prNumbers.map(async (stat) => {
      const prResponse = await octokit.graphql(PR_REVIEWS_QUERY, {
        name: stat.repoName,
        owner: stat.owner,
        pull_number: stat.prNum,
      });
      if (!prResponse?.repository?.pullRequest?.reviews) {
        throw new Error(`Couldn't get PR Reviews, ${stat.prNum}`);
      }
      const nodesDesc = prResponse.repository.pullRequest.reviews.nodes.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
      const latestQAReview = nodesDesc.find((item) =>
        CONSTS.QA_USERNAMES.find((username) => item.author.login === username)
      );
      const latestNonQAReview = nodesDesc.find(
        (item) =>
          !CONSTS.QA_USERNAMES.find(
            (username) => username === item.author.login
          )
      );
      const QAStatus = getReviewCommentStatus(latestQAReview);
      const QAStatusLatest = getReviewCommentStatus(latestQAReview, true);
      const EngineerStatus = getReviewCommentStatus(latestNonQAReview);
      const IsLatestCommitWIP = getIsLatestCommitWIP(
        latestQAReview || latestNonQAReview
      );
      return {
        prNumber: stat.prNum,
        repoName: stat.repoName,
        QAStatus,
        QAStatusLatest,
        EngineerStatus,
        IsLatestCommitWIP,
      };
    })
  );

  core.debug("All Open Prs: " + prettyStringify(allOpenPrs));
  return { totalBranches, branchesWithOpenPrs, allOpenPrs };
}

module.exports = {
  parsePullRequestFromUrl,
  getReviewCommentStatus,
  getDataFromPR,
  getStoryGithubStats,
  octokit,
  getPRComments,
};
