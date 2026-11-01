import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export interface ValidationSchema {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
}

export const validate = (schema: ValidationSchema | ZodSchema) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // If passed a direct ZodSchema, assume it validates the body
            if ('parseAsync' in schema && typeof schema.parseAsync === 'function') {
                req.body = await schema.parseAsync(req.body);
                return next();
            }

            const schemas = schema as ValidationSchema;

            if (schemas.body) {
                req.body = await schemas.body.parseAsync(req.body);
            }

            if (schemas.query) {
                req.query = (await schemas.query.parseAsync(req.query)) as any;
            }

            if (schemas.params) {
                req.params = (await schemas.params.parseAsync(req.params)) as any;
            }

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const issues = error.issues || [];
                const formattedErrors = issues.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                }));

                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: formattedErrors,
                });
                return;
            }

            next(error);
        }
    };
};

export const validateBody = (schema: ZodSchema) => validate({ body: schema });
export const validateQuery = (schema: ZodSchema) => validate({ query: schema });
export const validateParams = (schema: ZodSchema) => validate({ params: schema });
