import { Router } from "express";
import {  uploadChatImageVideoMiddleware } from "../middlewares/upload.middleware.js";
import { chatController } from "../../bootstrap/chat.bootstrap.js";

const chatRoutes = Router();

// Direct conversation endpoints
//need userId of recipient in body
chatRoutes.post("/direct", chatController.createDirectConversation);
//Create group conversation  
chatRoutes.post("/group", chatController.createGroupConversation);
//Change group name
//conversationId is in url params, new name is in body
chatRoutes.patch("/group/:conversationId/name", chatController.changeGroupName);
//only for group conversations
chatRoutes.delete("/group/:conversationId", chatController.deleteConversation);
//Get all conversations of the auth user, with pagination and sorting
//cursor and limit are query params for pagination
//default sortBy is updated_at, default sortOrder is desc
chatRoutes.get("/group", chatController.displayUserConversations);
//Get conversation details along with its users
chatRoutes.get("/group/:conversationId", chatController.getConversationDetails);
//Add users to group conversation, only for group conversations
//conversationId is in url params, userIdToAdd are in body as an array of strings
chatRoutes.post("/group/:conversationId/users", chatController.addUsersToGroup);
//userIdToRemove is in body, conversationId is in url params
chatRoutes.delete("/group/:conversationId/users", chatController.removeUsersFromGroup);
chatRoutes.post("/group/:conversationId/leave", chatController.leaveGroup);
//userIdToGrant is in body, conversationId is in url params
chatRoutes.post("/group/:conversationId/grant-admin", chatController.grantAdmin);

// Message endpoints
chatRoutes.post("/:conversationId/messages", uploadChatImageVideoMiddleware, chatController.sendMessage);
// Get messages for a conversation with pagination, sorting and searching
//cursor, limit, sortBy, sortOrder, search are query params
chatRoutes.get("/:conversationId/messages", chatController.paginateMessages);
//messageId is in url params, new content is in body
chatRoutes.put("/:conversationId/messages/:messageId", chatController.updateMessage);
chatRoutes.delete("/:conversationId/messages/:messageId", chatController.deleteMessage);

export default chatRoutes;