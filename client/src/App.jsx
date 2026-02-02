import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/components/Login';
import Signup from './pages/components/Signup';
import Dashboard from './pages/components/Dashboard';
import Tasks from './pages/components/Tasks';
import TaskDetails from './pages/components/TaskDetails';
import TaskBoard from './pages/components/TaskBoard';
import AssignTask from './pages/components/AssignTask';
import Members from './pages/components/Members';
import Teams from './pages/components/Teams';
import TeamManagement from './pages/components/TeamManagement';
import Subadmins from './pages/components/Subadmins';
import TeamChat from './pages/components/TeamChat';
import AdminChat from './pages/components/AdminChat';
import TeamTasks from './pages/components/TeamTasks';
import EditTeam from './pages/components/EditTeam';

import './index.css';
import './dark-theme.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Routes - All Roles */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <Tasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/:id"
            element={
              <ProtectedRoute>
                <TaskDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/taskboard"
            element={
              <ProtectedRoute>
                <TaskBoard />
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Admin & Subadmin Only */}
          <Route
            path="/assign"
            element={
              <ProtectedRoute allowedRoles={['admin', 'subadmin']}>
                <AssignTask />
              </ProtectedRoute>
            }
          />
          <Route
            path="/members"
            element={
              <ProtectedRoute allowedRoles={['admin', 'subadmin']}>
                <Members />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams"
            element={
              <ProtectedRoute allowedRoles={['admin', 'subadmin']}>
                <Teams />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-chat"
            element={
              <ProtectedRoute allowedRoles={['admin', 'subadmin']}>
                <AdminChat />
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Admin Only */}
          <Route
            path="/team-management"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <TeamManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/subadmins"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Subadmins />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams/:teamName/edit"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <EditTeam />
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Employee Only */}
          <Route
            path="/team-chat"
            element={
              <ProtectedRoute allowedRoles={['employee']}>
                <TeamChat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team-tasks"
            element={
              <ProtectedRoute allowedRoles={['employee']}>
                <TeamTasks />
              </ProtectedRoute>
            }
          />

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;