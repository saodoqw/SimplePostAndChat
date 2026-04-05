import { PostLikeRepository } from "../../../../domain/repositories/postlike.repository.js";
import { prisma } from "../prismaClient.js";


export class prismaPostLikeRepository implements PostLikeRepository {
    async toggle(postId: string, userId: string): Promise<boolean> {
        const existing = await prisma.postLike.findUnique({
            where: {
                post_id_user_id: { post_id: postId, user_id: userId },
            },
        });

        if (existing) {
            await prisma.postLike.delete({
                where: {
                    post_id_user_id: { post_id: postId, user_id: userId },
                },
            });
            return false;
        }

        await prisma.postLike.create({
            data: { post_id: postId, user_id: userId },
        });
        return true;
    }
    async like(postId: string, userId: string): Promise<void> {
        const likeRecord = {
            post_id: postId,
            user_id: userId,
        };
        return prisma.postLike.create({
            data: likeRecord,
        }).then(() => { });
    }
    async unlike(postId: string, userId: string): Promise<void> {
        return prisma.postLike.deleteMany({
            where: {
                post_id: postId,
                user_id: userId,
            }
        }).then(() => { });
    }
}