// Bootstrap file: Centralized wiring for chat feature
// This is where we compose all dependencies for chat (repositories, services, usecase, controller)
// Imported by routes and socket handlers to use pre-constructed, consistent instances

import { cloudinaryService } from "../infrastructure/imageStorage/cloudinary/cloudinary.service.js";
import { PrismaConservationQuery } from "../infrastructure/database/prisma/queries/prisma-conservation.query.js";
import { PrismaMessageQuery } from "../infrastructure/database/prisma/queries/prisma-message.query.js";
import { PrismaConservationRepository } from "../infrastructure/database/prisma/repositories/prisma-conservation.repository.js";
import { PrismaConservationMemberRepository } from "../infrastructure/database/prisma/repositories/prisma-conservationMember.repository.js";
import { PrismaMessageRepository } from "../infrastructure/database/prisma/repositories/prisma-message.repotsitory.js";
import { PrismaUserRepository } from "../infrastructure/database/prisma/repositories/prisma-user.repository.js";
import { ChatUseCase } from "../application/usecases/chats/chats.usecases.js";
import { ChatController } from "../interfaces/controllers/chat.controller.js";
import { emitNewMessageToConversation } from "../infrastructure/socket/chat.socket.js";

// Repositories
const conservationRepository = new PrismaConservationRepository();
const conservationMemberRepository = new PrismaConservationMemberRepository();
const messageRepository = new PrismaMessageRepository();
const userRepository = new PrismaUserRepository();

// Query services
const conservationQueryService = new PrismaConservationQuery();
const messageQueryService = new PrismaMessageQuery();

// Usecase
export const chatUseCase = new ChatUseCase(
    conservationRepository,
    conservationMemberRepository,
    messageRepository,
    conservationQueryService,
    messageQueryService,
    cloudinaryService,
    userRepository,
);

// Controller with callback already injected
export const chatController = new ChatController(
    chatUseCase,
    emitNewMessageToConversation,
);

console.log("[BOOTSTRAP] Chat controller initialized:", chatController?.constructor?.name);
