'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Проверяваме дали има запазен токен
    const token = localStorage.getItem('adminToken');
    
    if (token) {
      // Ако има токен, пренасочваме към dashboard
      router.push('/dashboard');
    } else {
      // Ако няма токен, пренасочваме към login
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        <p className="mt-2 text-gray-600">Зареждане...</p>
        </div>
    </div>
  );
}
