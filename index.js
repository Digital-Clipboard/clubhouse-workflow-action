const github = require("@actions/github");
const core = require("@actions/core");
const actionManager = require("./src/main");
const { prettyStringify } = require("./src/utils");
require("dotenv").config();

async function run() {
  try {
    const { payload, eventName } = github.context;
    const updatedStories = await actionManager(payload, eventName);
    core.setOutput("updatedStories", prettyStringify(updatedStories));
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
