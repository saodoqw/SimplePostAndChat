import "dotenv/config";
import express, {
    type Request,
    type Response,
    type NextFunction
} from 'express';
import cors from 'cors';
import cookieParser from "cookie-parser";
import apiRoutes from './interfaces/routes/index.js';

const app = express();

// Config CORS
const corsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
//middlewares
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

//health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});

//api routes
app.use('/api', apiRoutes);

//global error middleware
app.use(
    (error: unknown,
        req: Request,
        res: Response,
        next: NextFunction
    ): void => {
        const message = error instanceof Error ? error.message : 'Internal server error';
        res.status(500).json({ message });
    }
);


export default app;