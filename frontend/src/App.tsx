import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Scheduled } from './pages/Scheduled';
import { Sent } from './pages/Sent';
import { Detail } from './pages/Detail';
import { Compose } from './pages/Compose';
import { Senders } from './pages/Senders';
import { Slack } from './pages/Slack';

function App() {
  const [user, setUser] = useState<any>(null);

  return (
    <Router>
      <Routes>
        {/* Auth Route */}
        <Route path="/login" element={<Login />} />

        {/* Core Scheduled List */}
        <Route 
          path="/scheduled" 
          element={<Scheduled user={user} setUser={setUser} />} 
        />

        {/* Sent & Failed List */}
        <Route 
          path="/sent" 
          element={<Sent user={user} setUser={setUser} />} 
        />

        {/* Email Detail View */}
        <Route 
          path="/emails/:id" 
          element={<Detail user={user} setUser={setUser} />} 
        />

        {/* Compose Campaign */}
        <Route path="/compose" element={<Compose />} />

        {/* Senders Profile Management */}
        <Route 
          path="/senders" 
          element={<Senders user={user} setUser={setUser} />} 
        />

        {/* Slack Integration Panel */}
        <Route 
          path="/slack" 
          element={<Slack user={user} setUser={setUser} />} 
        />

        {/* Default Fallback */}
        <Route path="*" element={<Navigate to="/scheduled" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
