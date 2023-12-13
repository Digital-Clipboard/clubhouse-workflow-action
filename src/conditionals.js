/**
 * Conditional check that *ALL* Prs have QA Status and Engineer Status OK
 * @param {any[]} prs
 */
function PR_ALL_OK(prs) {
  return prs.every((pr) => pr.QAStatus === "OK" && pr.EngineerStatus === "OK");
}

/**
 * Conditional check that *ALL* Prs have QA Status OK
 * @param {any[]} prs
 */
function PR_ALL_QA_OK(prs) {
  return prs.every((pr) => pr.QAStatus === "OK");
}

/**
 * Conditional check that *ALL* Prs have Engineer Status OK
 * @param {any[]} prs
 */
function PR_ALL_ENG_OK(prs) {
  return prs.every((pr) => pr.EngineerStatus === "OK");
}

/**
 * Conditional check that *ANY* Prs have QA Status FAIL
 * @param {any[]} prs
 */
function PR_ANY_QA_FAIL(prs) {
  return prs.some((pr) => pr.QAStatus === "FAIL");
}

/**
 * Conditional check that *ANY* Prs have QA Status FAIL and Last Commit is not WIP
 * @param {any[]} prs
 */
function PR_ANY_QA_CHANGE_COMMIT_NOT_WIP(prs) {
  return prs.some(
    (pr) => pr.QAStatusLatest === "FAIL" && !pr.IsLatestCommitWIP
  );
}

module.exports = {
  PR_ALL_OK,
  PR_ALL_QA_OK,
  PR_ALL_ENG_OK,
  PR_ANY_QA_FAIL,
  PR_ANY_QA_CHANGE_COMMIT_NOT_WIP,
};
