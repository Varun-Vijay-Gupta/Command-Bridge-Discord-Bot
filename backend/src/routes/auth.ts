import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/database';
import { signToken } from '../utils/jwt';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody, asyncHandler } from '../middleware/validate';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

authRouter.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res: Response) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = signToken({ adminId: admin.id, email: admin.email });
    res.json({
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name },
    });
  })
);

authRouter.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin!.id },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }

    res.json(admin);
  })
);
