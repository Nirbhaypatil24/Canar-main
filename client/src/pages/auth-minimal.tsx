import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function AuthMinimal() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      setLocation("/subscription");
    }
  }, [user, setLocation]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({
      username: email,
      password: password,
    }, {
      onSuccess: () => {
        // Force a page reload to ensure session is recognized
        window.location.href = "/subscription";
      }
    });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords don't match");
      return;
    }
    registerMutation.mutate({
      email: email,
      username: username,
      password: password,
    }, {
      onSuccess: () => {
        // Force a page reload to ensure session is recognized
        window.location.href = "/subscription";
      }
    });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    marginBottom: '16px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '16px',
    backgroundColor: 'white',
    color: 'black',
    pointerEvents: 'auto',
    userSelect: 'auto',
    zIndex: 999999,
    position: 'relative'
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>
          Canar - {isLogin ? 'Sign In' : 'Sign Up'}
        </h1>

        <form onSubmit={isLogin ? handleLogin : handleRegister}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            required
          />

          {!isLogin && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={inputStyle}
              required
            />
          )}

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            required
          />

          {!isLogin && (
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
              required
            />
          )}

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              marginBottom: '16px'
            }}
            disabled={loginMutation.isPending || registerMutation.isPending}
          >
            {(loginMutation.isPending || registerMutation.isPending) ? 'Loading...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>

          <p style={{ textAlign: 'center', color: '#666' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              style={{
                background: 'none',
                border: 'none',
                color: '#007bff',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </form>

        <div style={{ marginTop: '20px', fontSize: '12px', color: '#999' }}>
          <p>Current values:</p>
          <p>Email: {email}</p>
          <p>Username: {username}</p>
          <p>Password: {"*".repeat(password.length)}</p>
          <p>Login pending: {loginMutation.isPending ? 'yes' : 'no'}</p>
          <p>Register pending: {registerMutation.isPending ? 'yes' : 'no'}</p>
        </div>
      </div>
    </div>
  );
}