import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyDto } from './dto/verify.dto';

// 1. Define the User Interface so TypeScript knows what a "User" is
export interface User extends RegisterDto {
  id: string;
  isVerified: boolean;
}

@Injectable()
export class AuthService {
  // 2. Apply the interface to the array
  private readonly users: User[] = []; 
  private readonly otps = new Map<string, string>();

  async register(registerDto: RegisterDto) {
    // Hash password (omitted for brevity, use bcrypt)
    const newUser: User = { 
      ...registerDto, 
      id: Date.now().toString(), 
      isVerified: false 
    };
    
    this.users.push(newUser); // Now valid because 'users' expects 'User' objects
    
    // Generate OTP
    const otp = "123456"; // Mock OTP
    this.otps.set(newUser.email, otp);

    return { 
      message: 'User registered. Please verify.', 
      email: newUser.email,
      debugOtp: otp 
    };
  }

  async login(loginDto: LoginDto) {
    // 3. TypeScript now knows 'u' has an 'email' property
    const user = this.users.find(u => u.email === loginDto.email);

    if (!user || user.password !== loginDto.password) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    return { accessToken: 'mock_jwt_token', user };
  }

  async verify(verifyDto: VerifyDto) {
    const storedOtp = this.otps.get(verifyDto.email);
    
    if (storedOtp !== verifyDto.code) {
      throw new UnauthorizedException('Invalid OTP');
    }
    
    const user = this.users.find(u => u.email === verifyDto.email);
    
    // 4. TypeScript now knows 'user' has 'isVerified'
    if (user) {
      user.isVerified = true;
    }
    
    return { message: 'Verification successful', verified: true };
  }
}