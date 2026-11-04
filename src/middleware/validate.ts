import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export interface ValidationSchema {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
}

const setProperty = (obj: any, prop: string, value: any) => {
    try {
        obj[prop] = value;
    } catch {
        Object.defineProperty(obj, prop, {
            value,
            writable: true,
            enumerable: true,
            configurable: true,
        });
    }
};

export const validate = (schema: ValidationSchema | ZodSchema) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // If passed a direct ZodSchema, assume it validates the body
            if ('parseAsync' in schema && typeof schema.parseAsync === 'function') {
                const parsedBody = await schema.parseAsync(req.body);
                setProperty(req, 'body', parsedBody);
                return next();
            }

            const schemas = schema as ValidationSchema;

            if (schemas.body) {
                const parsedBody = await schemas.body.parseAsync(req.body);
                setProperty(req, 'body', parsedBody);
            }

            if (schemas.query) {
                const parsedQuery = (await schemas.query.parseAsync(req.query)) as any;
                setProperty(req, 'query', parsedQuery);
            }

            if (schemas.params) {
                const parsedParams = (await schemas.params.parseAsync(req.params)) as any;
                setProperty(req, 'params', parsedParams);
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
