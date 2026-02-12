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
import ForgetPassword from './pages/components/ForgetPassword';
import ResetPassword from './pages/components/ResetPassword';
import EnterOTP from './pages/components/EnterOTP';
import VerifyEmail from './pages/components/VerifyEmail';
import Profile from './pages/components/Profile';
import Project from './pages/components/Project';
import ProjectDetails from './pages/components/ProjectDetails';
import EditProject from './pages/components/EditProject';
import CreateProject from './pages/components/CreateProject';

import './app.css';
import './dark-theme.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forget-password" element={<ForgetPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/enter-otp" element={<EnterOTP />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          {/* Protected Routes - All Roles */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
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
          <Route
            path="/projects/:id"
            element={
              <ProtectedRoute allowedRoles={['admin', 'subadmin']}>
                <ProjectDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id/edit"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <EditProject />
              </ProtectedRoute>
            }
          />
          {/* Protected Routes - Admin & Subadmin Only */}
          <Route
            path="/assign"
            element={
              <ProtectedRoute allowedRoles={['admin', 'subadmin', 'employee']}>
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
            path="/projects"
            element={
              <ProtectedRoute allowedRoles={['admin', 'subadmin']}>
                <Project />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/create"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <CreateProject />
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