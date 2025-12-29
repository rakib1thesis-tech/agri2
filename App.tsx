import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import PublicDashboard from './pages/PublicDashboard';
import Pricing from './pages/Pricing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Overview from './pages/Dashboard/Overview';
import UserFields from './pages/Dashboard/UserFields';
import Sensors from './pages/Dashboard/Sensors';
import Management from './pages/Dashboard/Management';
import FeaturesPublic from './pages/FeaturesPublic';
import HowItWorks from './pages/HowItWorks';

import { User } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    setActiveTab('home');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <Home onGetStarted={() => setActiveTab('signup')} />;
      case 'features-public': return <FeaturesPublic onNavigate={(tab) => setActiveTab(tab)} />;
      case 'how-it-works': return <HowItWorks />;
      case 'public-dashboard': return <PublicDashboard />;
      case 'pricing': return <Pricing />;
      case 'login': return <Login onLogin={handleLogin} onSwitchToSignup={() => setActiveTab('signup')} />;
      case 'signup': return <Signup onSignup={handleLogin} onSwitchToLogin={() => setActiveTab('login')} />;
      
      // Auth Protected
      case 'dashboard': return isLoggedIn ? <Overview user={currentUser!} /> : <Login onLogin={handleLogin} onSwitchToSignup={() => setActiveTab('signup')} />;
      case 'management': return isLoggedIn ? <Management /> : <Login onLogin={handleLogin} onSwitchToSignup={() => setActiveTab('signup')} />;
      case 'fields': return isLoggedIn ? <UserFields user={currentUser!} /> : <Login onLogin={handleLogin} onSwitchToSignup={() => setActiveTab('signup')} />;
      case 'sensors': return isLoggedIn ? <Sensors /> : <Login onLogin={handleLogin} onSwitchToSignup={() => setActiveTab('signup')} />;
      
      default: return <Home onGetStarted={() => setActiveTab('signup')} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isLoggedIn={isLoggedIn} 
        onLogout={handleLogout} 
      />
      
      <main className="flex-grow">
        {renderContent()}
      </main>

      <Footer onNavigate={setActiveTab} />
    </div>
  );
};

export default App;