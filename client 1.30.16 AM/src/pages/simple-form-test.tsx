import { useState } from "react";

export default function SimpleFormTest() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div style={{ padding: '50px' }}>
      <h1>Simple Form Test</h1>
      
      <div style={{ marginBottom: '30px' }}>
        <h3>React State Controlled Inputs</h3>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '300px',
            height: '40px',
            padding: '10px',
            margin: '10px 0',
            border: '2px solid #333',
            fontSize: '16px',
            background: 'white',
            color: 'black',
            display: 'block'
          }}
        />
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{
            width: '300px',
            height: '40px',
            padding: '10px',
            margin: '10px 0',
            border: '2px solid #333',
            fontSize: '16px',
            background: 'white',
            color: 'black',
            display: 'block'
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '300px',
            height: '40px',
            padding: '10px',
            margin: '10px 0',
            border: '2px solid #333',
            fontSize: '16px',
            background: 'white',
            color: 'black',
            display: 'block'
          }}
        />
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h3>Values:</h3>
        <p>Email: {email}</p>
        <p>Username: {username}</p>
        <p>Password: {password}</p>
      </div>

      <div>
        <h3>Uncontrolled Inputs</h3>
        <input
          type="email"
          placeholder="Uncontrolled Email"
          style={{
            width: '300px',
            height: '40px',
            padding: '10px',
            margin: '10px 0',
            border: '2px solid #333',
            fontSize: '16px',
            background: 'white',
            color: 'black',
            display: 'block'
          }}
        />
      </div>
    </div>
  );
}