// apps/mobile-app/src/app/(auth)/_layout.tsx
import React from 'react'
import { Stack } from 'expo-router'

const AuthLayout = () => {
  return (
    <>
      <Stack>
        <Stack.Screen
          name='Auth'
          options={{
            headerShown: false
          }}
        />
        <Stack.Screen
          name='Verification'
          options={{
            headerShown: false
          }}
        />
        <Stack.Screen
          name='ForgotPassword'
          options={{
            headerShown: false
          }}
        />
        <Stack.Screen
          name='ResetPassword'
          options={{
            headerShown: false
          }}
        />
      </Stack>
    </>
  )
}

export default AuthLayout
