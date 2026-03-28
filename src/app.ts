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
const corsOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
    .split(",").map(url => url.trim());

const commonCorsOptions = {
    origin: corsOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
};
const corsOptions = {
    ...commonCorsOptions,
    credentials: false,
};
//Cors options for routes that require cookies (login, refresh token, logout)
const cookieCorsOptions = {
    ...commonCorsOptions,
    credentials: true,
};

//middlewares
app.use(cors(corsOptions));
//Need CORS with credentials to allow cookies to be sent and received from the frontend
app.use("/api/auth/login", cors(cookieCorsOptions));
app.use("/api/auth/refresh-token", cors(cookieCorsOptions));
app.use("/api/auth/logout", cors(cookieCorsOptions));

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