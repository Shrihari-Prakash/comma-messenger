const chai = require("chai");

var server = require("../app").server;

var objectIds = {
  threadId: null,
  tabIds: {
    withAuthentication: null,
    withoutAuthentication: null,
  },
};

var user1 = {
  _id: null,
  apiToken: null,
  email: null,
  password: null,
  socketConnection: null,
};

var user2 = {
  _id: null,
  apiToken: null,
  email: null,
  socketConnection: null,
};

exports.server = server;
exports.chai = chai;
exports.objectIds = objectIds;
exports.user1 = user1;
exports.user2 = user2;
