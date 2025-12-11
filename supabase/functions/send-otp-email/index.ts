// Supabase Edge Function for sending OTP emails
// Deploy with: supabase functions deploy send-otp-email

// @ts-nocheck - Deno edge function, type definitions loaded at runtime
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.203.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

interface EmailRequest {
  email: string
  otp: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, otp } = await req.json() as EmailRequest

    // Validate input
    if (!email || !otp) {
      throw new Error('Email and OTP are required')
    }

    // Check if API key is configured
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured')
    }

    // Send email using Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'The Awesome UIU <onboarding@resend.dev>',
        to: [email],
        subject: 'Your Verification Code - The Awesome UIU',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; padding: 40px;">
          <tr>
            <td align="center" style="padding-bottom: 20px;">
              <h1 style="color: #333333; font-size: 24px; margin: 0;">The Awesome UIU</h1>
              <p style="color: #666666; font-size: 14px; margin: 5px 0 0 0;">Scholarship Probability Checker</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 0;">
              <h2 style="color: #333333; font-size: 20px; margin: 0 0 10px 0;">Verify Your Email</h2>
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0;">
                You requested to check your scholarship probability. Please use the verification code below:
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 30px 0;">
              <div style="background-color: #f0f0f0; border: 2px solid #6366f1; border-radius: 8px; padding: 20px; display: inline-block;">
                <p style="color: #999999; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
                <p style="color: #6366f1; font-size: 36px; font-weight: bold; margin: 0; letter-spacing: 4px;">${otp}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px; background-color: #fff9e6; border-left: 4px solid #f59e0b; border-radius: 4px;">
              <p style="color: #856404; font-size: 14px; margin: 0;">
                <strong>Important:</strong> This code will expire in 5 minutes. If you didn't request this code, please ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 30px;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                The Awesome UIU - Student Tools for UIU<br>
                This is an unofficial student-made platform.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend API error:', {
        status: res.status,
        statusText: res.statusText,
        error: data
      })
      throw new Error(`Resend API error: ${JSON.stringify(data)}`)
    }

    console.log('Email sent successfully:', {
      messageId: data.id,
      to: email,
      status: res.status
    })

    return new Response(
      JSON.stringify({ success: true, messageId: data.id }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error sending email:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
