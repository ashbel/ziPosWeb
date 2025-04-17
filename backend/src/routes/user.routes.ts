import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { validateUser, validateRole } from '../validators/user.validator';
import { authenticate, authorize } from '../middleware/auth.middleware';

export const userRouter = Router();
const userController = new UserController();

userRouter.use(authenticate);

userRouter.get(
  '/',
  authorize(['manage_users']),
  userController.getUsers
);

userRouter.post(
  '/',
  authorize(['manage_users']),
  validateUser,
  userController.createUser
);

userRouter.put(
  '/:id',
  authorize(['manage_users']),
  validateUser,
  userController.updateUser
);

userRouter.delete(
  '/:id',
  authorize(['manage_users']),
  userController.deleteUser
);

userRouter.get(
  '/roles',
  authorize(['manage_roles']),
  userController.getRoles
);

userRouter.post(
  '/roles',
  authorize(['manage_roles']),
  validateRole,
  userController.createRole
); 