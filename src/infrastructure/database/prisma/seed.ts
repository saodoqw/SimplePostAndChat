import "dotenv/config";
import { hashSync } from "bcryptjs";
import { prisma } from "./prismaClient.js";

const USER_COUNT = 10;
const POSTS_PER_USER = 3;
const COMMENTS_PER_POST = 2;
const DIRECT_CONVERSATION_COUNT = 4;
const GROUP_CONVERSATION_COUNT = 2;
const MESSAGES_PER_CONVERSATION = 6;

function pickRandom<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)] as T;
}

function pickDistinctUsers(userIds: string[], count: number): string[] {
    const shuffled = [...userIds].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

async function resetData(): Promise<void> {
    await prisma.messageMedia.deleteMany();
    await prisma.commentMedia.deleteMany();
    await prisma.postMedia.deleteMany();
    await prisma.postLike.deleteMany();
    await prisma.message.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.conversationUser.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.follow.deleteMany();
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();
}

async function seedUsers(): Promise<string[]> {
    const passwordHash = hashSync("123456", 10);
    const users = [] as string[];

    for (let i = 1; i <= USER_COUNT; i += 1) {
        const user = await prisma.user.create({
            data: {
                username: `testuser${i}`,
                email: `testuser${i}@example.com`,
                password_hash: passwordHash,
                bio: `This is test user ${i}`,
                avatar_url: `https://api.dicebear.com/9.x/initials/svg?seed=testuser${i}`,
                public_id: `avatar-testuser-${i}`,
            },
        });

        users.push(user.id);
    }

    return users;
}

async function seedFollows(userIds: string[]): Promise<void> {
    for (const userId of userIds) {
        const otherUsers = userIds.filter((id) => id !== userId);
        const follows = pickDistinctUsers(otherUsers, 2);

        for (const targetId of follows) {
            await prisma.follow.create({
                data: {
                    follower_id: userId,
                    following_id: targetId,
                },
            });
        }
    }
}

async function seedPostsLikesComments(userIds: string[]): Promise<void> {
    const postIds = [] as string[];

    for (const authorId of userIds) {
        for (let i = 1; i <= POSTS_PER_USER; i += 1) {
            const post = await prisma.post.create({
                data: {
                    author_id: authorId,
                    content: `Sample post ${i} from user ${authorId.slice(0, 8)}`,
                },
            });
            postIds.push(post.id);

            if (i % 2 === 0) {
                await prisma.postMedia.create({
                    data: {
                        post_id: post.id,
                        media_url: `https://picsum.photos/seed/${post.id}/640/480`,
                        media_type: "image",
                        public_id: `post-media-${post.id}`,
                    },
                });
            }

            const likers = pickDistinctUsers(userIds.filter((id) => id !== authorId), 3);
            for (const likerId of likers) {
                await prisma.postLike.create({
                    data: {
                        post_id: post.id,
                        user_id: likerId,
                    },
                });
            }
        }
    }

    for (const postId of postIds) {
        const commenters = pickDistinctUsers(userIds, COMMENTS_PER_POST);
        let commentIndex = 1;
        for (const commenterId of commenters) {
            const comment = await prisma.comment.create({
                data: {
                    post_id: postId,
                    user_id: commenterId,
                    content: `Comment ${commentIndex} for post ${postId.slice(0, 8)}`,
                },
            });

            if (commentIndex % 2 === 0) {
                await prisma.commentMedia.create({
                    data: {
                        comment_id: comment.id,
                        media_url: `https://picsum.photos/seed/comment-${comment.id}/500/500`,
                        media_type: "image",
                        public_id: `comment-media-${comment.id}`,
                    },
                });
            }

            commentIndex += 1;
        }
    }
}

async function seedConversationsAndMessages(userIds: string[]): Promise<void> {
    for (let i = 0; i < DIRECT_CONVERSATION_COUNT; i += 1) {
        const members = pickDistinctUsers(userIds, 2);
        if (members.length < 2) {
            continue;
        }

        const conversation = await prisma.conversation.create({
            data: {
                name: `Direct ${i + 1}`,
                is_group: false,
            },
        });

        await prisma.conversationUser.create({
            data: {
                conversation_id: conversation.id,
                user_id: members[0] as string,
                is_admin: true,
            },
        });

        await prisma.conversationUser.create({
            data: {
                conversation_id: conversation.id,
                user_id: members[1] as string,
                is_admin: false,
            },
        });

        for (let messageIndex = 1; messageIndex <= MESSAGES_PER_CONVERSATION; messageIndex += 1) {
            const senderId = pickRandom(members);
            const message = await prisma.message.create({
                data: {
                    conversation_id: conversation.id,
                    sender_id: senderId,
                    content: `Direct message ${messageIndex} in ${conversation.name}`,
                },
            });

            if (messageIndex % 3 === 0) {
                await prisma.messageMedia.create({
                    data: {
                        message_id: message.id,
                        media_url: `https://picsum.photos/seed/message-${message.id}/400/300`,
                        media_type: "image",
                        public_id: `message-media-${message.id}`,
                    },
                });
            }
        }
    }

    for (let i = 0; i < GROUP_CONVERSATION_COUNT; i += 1) {
        const members = pickDistinctUsers(userIds, 4);
        if (members.length < 3) {
            continue;
        }

        const conversation = await prisma.conversation.create({
            data: {
                name: `Test Group ${i + 1}`,
                is_group: true,
            },
        });

        for (let memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
            await prisma.conversationUser.create({
                data: {
                    conversation_id: conversation.id,
                    user_id: members[memberIndex] as string,
                    is_admin: memberIndex === 0,
                },
            });
        }

        for (let messageIndex = 1; messageIndex <= MESSAGES_PER_CONVERSATION; messageIndex += 1) {
            const senderId = pickRandom(members);
            await prisma.message.create({
                data: {
                    conversation_id: conversation.id,
                    sender_id: senderId,
                    content: `Group message ${messageIndex} in ${conversation.name}`,
                },
            });
        }
    }
}

async function main(): Promise<void> {
    await prisma.$connect();
    await resetData();

    const userIds = await seedUsers();
    await seedFollows(userIds);
    await seedPostsLikesComments(userIds);
    await seedConversationsAndMessages(userIds);

    const [users, follows, posts, postLikes, comments, conversations, messages] = await Promise.all([
        prisma.user.count(),
        prisma.follow.count(),
        prisma.post.count(),
        prisma.postLike.count(),
        prisma.comment.count(),
        prisma.conversation.count(),
        prisma.message.count(),
    ]);

    console.log("Seed completed");
    console.log({
        users,
        follows,
        posts,
        postLikes,
        comments,
        conversations,
        messages,
        loginHint: {
            email: "testuser1@example.com",
            password: "123456",
        },
    });
}

void main()
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
