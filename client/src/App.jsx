import { Routes, Route, useParams } from 'react-router-dom';
import TransferPage from './components/TransferPage';

function SenderPage() {
  return <TransferPage mode="sender" initialRoomId={null} />;
}

function ReceiverPage() {
  const { roomId } = useParams();
  return <TransferPage mode="receiver" initialRoomId={roomId} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SenderPage />} />
      <Route path="/room/:roomId" element={<ReceiverPage />} />
    </Routes>
  );
}
