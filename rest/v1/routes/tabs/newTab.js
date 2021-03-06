const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
var ObjectId = require("mongodb").ObjectID;

const errors = require("../../../../utils/errors");
const errorModel = require("../../../../utils/errorResponse");

router.post("/", async function (req, res) {
  createThread(req, res);
});

async function createThread(req, res) {
  //Start of input validation.
  let db = req.app.get("mongoInstance");

  let loggedInUserId = req.header("x-cm-user-id");

  let tabDetails = req.body;

  if (!tabDetails.thread_id) {
    let error = new errorModel.errorResponse(
      errors.invalid_input.withDetails(
        "No valid `thread_id` was sent along with the request."
      )
    );
    return res.status(400).json(error);
  }

  if (!tabDetails.tab_name) {
    let error = new errorModel.errorResponse(
      errors.invalid_input.withDetails(
        "No valid `tab_name` was sent along with the request."
      )
    );
    return res.status(400).json(error);
  }

  if (typeof tabDetails.require_authentication !== "boolean") {
    let error = new errorModel.errorResponse(
      errors.invalid_input.withDetails(
        "No valid value for `require_authentication` was sent along with the request."
      )
    );
    return res.status(400).json(error);
  }
  //End of input validation.

  try {
    var tabCount = await db
      .collection("tabs")
      .find({ thread_id: ObjectId(tabDetails.thread_id) })
      .count();

    console.log("Current tab count:", tabCount);

    if (tabCount >= 3) {
      let error = new errorModel.errorResponse(
        errors.max_tab_limit.withDetails("Maximum tab limit reached")
      );
      return res.status(400).json(error);
    }

    var threadObject = await db
      .collection("threads")
      .findOne({ _id: ObjectId(tabDetails.thread_id) });

    if (!threadObject) {
      let error = new errorModel.errorResponse(
        errors.not_found.withDetails(
          "No valid `thread_id` was sent along with the request."
        )
      );
      return res.status(404).json(error);
    }

    var hasAccess = threadObject.thread_participants.some(function (
      participantId
    ) {
      return participantId.equals(ObjectId(loggedInUserId));
    });
    if (!hasAccess) {
      let error = new errorModel.errorResponse(errors.invalid_key);
      return res.status(403).json(error);
    }

    let tabObject = {
      tab_name: tabDetails.tab_name,
      thread_id: ObjectId(tabDetails.thread_id),
      new_for: [],
      secured_for: [],
      date_created: new Date(),
      seen_status: [],
    };

    threadObject.thread_participants.forEach((participantId) => {
      tabObject.seen_status.push({
        user_id: participantId, //Already of type ObjectId.
        last_read_message_id: null,
      });
    });

    if (tabDetails.require_authentication == true)
      tabObject.secured_for.push(ObjectId(loggedInUserId));

    //Insert into tabs and push the inserted tab _id into array of tabs in threads.
    var tabInsertResult = await db.collection("tabs").insertOne(tabObject, {
      w: 1,
    });

    let insertedTabId = tabObject._id;

    var threadUpdateResult = await db
      .collection("threads")
      .updateOne(
        { _id: ObjectId(tabDetails.thread_id) },
        { $push: { tabs: insertedTabId } }
      );

    if (threadUpdateResult.result.ok != 1 || tabInsertResult.result.ok != 1) {
      let error = new errorModel.errorResponse(errors.internal_error);
      return res.status(500).json(error);
    }

    //Send newly created tab to other member if they are online.
    let connectionMap = req.app.get("connectionMap");
    threadObject.thread_participants.forEach((receiverId) => {
      if (
        Array.isArray(connectionMap[receiverId]) &&
        !receiverId.equals(loggedInUserId)
      )
        connectionMap[receiverId].forEach((socketConnection) => {
          socketConnection.emit("_newTab", tabObject);
        });
    });

    return res.status(200).json({
      status: 200,
      message: "Tab created.",
      result: tabObject,
    });
  } catch (e) {
    console.log(e);
    let error = new errorModel.errorResponse(errors.internal_error);
    return res.status(500).json(error);
  }
}

function isEmptyOrSpaces(str) {
  return str === null || str.match(/^ *$/) !== null;
}

module.exports = router;
