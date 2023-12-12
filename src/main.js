const core = require("@actions/core");
const { getStoryGithubStats } = require("./github");
const { transitionStories, client, getAllStoryIds } = require("./shortcut");
const CONSTS = require("./consts");
const {
  PR_ALL_OK,
  PR_ALL_QA_OK,
  PR_ANY_QA_FAIL,
  PR_ANY_QA_CHANGE_COMMIT_NOT_WIP,
} = require("./conditionals");

/**
 * * @param {import("@actions/github/lib/interfaces").WebhookPayload} payload
 */
async function onPullRequestOpen(payload) {
  if (!payload.pull_request) {
    core.debug("No Pull Request \n\n\n" + JSON.stringify(payload));
    throw new Error("No Pull Request");
  }
  const storyIds = getAllStoryIds(payload);
  const updatedStories = [];

  for (const storyId of storyIds) {
    const stats = await getStoryGithubStats(storyId, client);
    // TODO: Check this logic, might break
    if (stats.totalBranches === stats.branchesWithOpenPrs) {
      transitionStories(
        [storyId],
        CONSTS.SHORTCUT_STATE_NAMES.READY_FEATURE_QA
      );
      updatedStories.push(storyId);
    }
  }
  return updatedStories;
}

/**
 * * @param {import("@actions/github/lib/interfaces").WebhookPayload} payload
 */
async function onPullRequestReview(payload) {
  if (!payload.pull_request) {
    core.debug("No Pull Request \n\n\n" + JSON.stringify(payload));
    throw new Error("No Pull Request");
  }
  const storyIds = getAllStoryIds(payload);
  const updatedStories = [];

  for (const storyId of storyIds) {
    const stats = await getStoryGithubStats(storyId, client);
    // TODO: Check this logic, might break
    if (stats.totalBranches === stats.branchesWithOpenPrs) {
      if (PR_ALL_OK(stats.allOpenPrs)) {
        transitionStories([storyId], CONSTS.SHORTCUT_STATE_NAMES.READY_STAGING);
        updatedStories.push(storyId);
      } else if (PR_ALL_QA_OK(stats.allOpenPrs)) {
        transitionStories(
          [storyId],
          CONSTS.SHORTCUT_STATE_NAMES.READY_CODE_REVIEW
        );
        updatedStories.push(storyId);
      } else if (PR_ANY_QA_FAIL(stats.allOpenPrs)) {
        transitionStories([storyId], CONSTS.SHORTCUT_STATE_NAMES.TEST_FAIL);
        updatedStories.push(storyId);
      }
    }
  }
  return updatedStories;
}

/**
 *
 * @param {import("@actions/github/lib/interfaces").WebhookPayload} payload
 */
async function onPullRequestSynchronize(payload) {
  if (!payload.pull_request) {
    core.debug("No Pull Request \n\n\n" + JSON.stringify(payload));
    throw new Error("No Pull Request");
  }
  const storyIds = getAllStoryIds(payload);
  const updatedStories = [];
  for (const storyId of storyIds) {
    const stats = await getStoryGithubStats(storyId, client);
    // TODO: Check this logic, might break
    console.log(stats);
    if (stats.totalBranches === stats.branchesWithOpenPrs) {
      if (PR_ANY_QA_CHANGE_COMMIT_NOT_WIP(stats.allOpenPrs)) {
        transitionStories(
          [storyId],
          CONSTS.SHORTCUT_STATE_NAMES.READY_FEATURE_QA
        );
        updatedStories.push(storyId);
      }
    }
  }
  return updatedStories;
}

/**
 *
 * @param {import("@actions/github/lib/interfaces").WebhookPayload} payload
 * @param {string} eventName
 */
async function actionManager(payload, eventName) {
  switch (eventName) {
    case "pull_request": {
      if (payload.action === "synchronize") {
        const updatedStories = await onPullRequestSynchronize(payload);
        return updatedStories;
      }
      if (payload.action === "opened" || payload.action === "reopened") {
        const updatedStories = await onPullRequestOpen(payload);
        return updatedStories;
      }
      throw new Error(`Invalid pull request action ${payload.action}`);
    }
    case "pull_request_review": {
      const updatedStories = await onPullRequestReview(payload);
      return updatedStories;
    }
    default:
      throw new Error(`Invalid event type ${eventName}`);
  }
}

module.exports = actionManager;
