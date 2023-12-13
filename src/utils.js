/**
 * Util function that pretty stringifies an object
 * @param {unknown} obj Object that will get pretty stringified
 * @returns {string}
 */
function prettyStringify(obj) {
  return JSON.stringify(obj, null, 2);
}

module.exports = {
  prettyStringify,
};
