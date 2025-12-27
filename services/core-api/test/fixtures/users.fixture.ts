// Test fixtures for user data
import { randomUUID } from 'crypto';

export const createMockUser = (overrides = {}) => ({
  id: randomUUID(),
  email: 'test@example.com',
  password: '$2b$10$hashedpassword', // Pre-hashed password
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: new Date('1990-01-01'),
  isEmailVerified: false,
  otpCode: '123456',
  otpExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
  refreshToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createVerifiedMockUser = (overrides = {}) =>
  createMockUser({
    isEmailVerified: true,
    otpCode: null,
    otpExpiry: null,
    ...overrides,
  });

export const mockRegisterDto = {
  email: 'test@example.com',
  password: 'password123',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-01',
};

export const mockLoginDto = {
  email: 'test@example.com',
  password: 'password123',
};

export const mockVerifyDto = {
  email: 'test@example.com',
  code: '123456',
};
