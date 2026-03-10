import express,{
    type Request,
    type Response,
    type NextFunction
} from 'express';
import cors from 'cors';
import apiRoutes from './interfaces/routes/index.js';

const app = express();

//middlewares
app.use(cors());    
app.use(express.json());

//health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});

//api routes
app.use('/api', apiRoutes);

//global error middleware
app.use(
    (   error:unknown,
        req: Request,
        res: Response,
        next: NextFunction
    ) : void => {
        const message = error instanceof Error ? error.message : 'Internal server error';
        res.status(500).json({ message });
    }
);


export default app;