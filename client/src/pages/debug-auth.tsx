import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function DebugAuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted with:', { email, password });
    
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const result = await response.json();
      console.log('Registration result:', result);
      
      if (response.ok) {
        alert('Registration successful!');
      } else {
        alert('Registration failed: ' + (result.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <h1 className="text-2xl font-bold mb-6 text-center">Debug Registration Form</h1>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="debug-email" className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <Input
                id="debug-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full"
                style={{ 
                  pointerEvents: 'auto',
                  userSelect: 'auto',
                  cursor: 'text',
                  background: 'white',
                  color: 'black'
                }}
                autoComplete="email"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Current value: "{email}"</p>
            </div>

            <div>
              <label htmlFor="debug-password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <Input
                id="debug-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full"
                style={{ 
                  pointerEvents: 'auto',
                  userSelect: 'auto',
                  cursor: 'text',
                  background: 'white',
                  color: 'black'
                }}
                autoComplete="new-password"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Password length: {password.length}</p>
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={!email || !password}
            >
              Register Account
            </Button>
            
            <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
              <strong>Debug Info:</strong><br/>
              Email: {email || '(empty)'}<br/>
              Password: {'*'.repeat(password.length) || '(empty)'}<br/>
              Form valid: {email && password ? 'Yes' : 'No'}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}