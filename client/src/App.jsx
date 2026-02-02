import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import TaskDetails from './pages/TaskDetails';
import TaskBoard from './pages/TaskBoard';
import AssignTask from './pages/AssignTask';
import Employees from './pages/Employees';
import Teams from './pages/Teams';
import TeamManagement from './pages/TeamManagement';
import Subadmins from './pages/Subadmins';
import TeamChat from './pages/TeamChat';
import AdminChat from './pages/AdminChat';
import TeamTasks from './pages/TeamTasks';
import EditTeam from './pages/EditTeam';

import './index.css';

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
            path="/employees"
            element={
              <ProtectedRoute allowedRoles={['admin', 'subadmin']}>
                <Employees />
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
