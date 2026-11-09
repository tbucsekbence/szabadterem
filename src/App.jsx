import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Rooms from './pages/Rooms';
import RoomDetail from './pages/RoomDetail';
import Booking from './pages/Booking';
import BookingResult from './pages/BookingResult';
import HowItWorks from './pages/HowItWorks';
import Contact from './pages/Contact';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Account from './pages/Account';
import Admin from './pages/Admin';
import Terms from './pages/Terms';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="termeink" element={<Rooms />} />
        <Route path="termeink/:id" element={<RoomDetail />} />
        <Route path="foglalas" element={<Booking />} />
        <Route path="foglalas/sikeres" element={<BookingResult success />} />
        <Route path="foglalas/megszakitva" element={<BookingResult />} />
        <Route path="hogyan-mukodik" element={<HowItWorks />} />
        <Route path="kapcsolat" element={<Contact />} />
        <Route path="aszf" element={<Terms />} />
        <Route path="belepes" element={<Login />} />
        <Route path="regisztracio" element={<Navigate to="/belepes" replace />} />
        <Route path="profil" element={<Profile />} />
        <Route path="fiokom" element={<Account />} />
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
