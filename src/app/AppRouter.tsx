import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage, type HomeViewModel } from '../pages/HomePage';

type AppRouterProps = { homeViewModel: HomeViewModel };

function Placeholder({ title }: { title: string }) {
  return <main className="page"><h2>{title}</h2></main>;
}

export function AppRouter({ homeViewModel }: AppRouterProps) {
  return (
    <Routes>
      <Route path="/" element={<HomePage viewModel={homeViewModel} />} />
      <Route path="/study" element={<Placeholder title="집중 학습" />} />
      <Route path="/test/setup" element={<Placeholder title="수시 단어 테스트" />} />
      <Route path="/test/run" element={<Placeholder title="테스트 진행" />} />
      <Route path="/test/result" element={<Placeholder title="테스트 결과" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
