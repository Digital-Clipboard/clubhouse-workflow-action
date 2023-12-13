function prettyStringify(obj) {
  return JSON.stringify(obj, null, 2);
}

module.exports = {
  prettyStringify,
};
