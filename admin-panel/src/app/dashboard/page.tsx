'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getPendingDrivers, getAllDrivers, type DriverForAdmin } from '@/lib/adminAPI';

export default function DashboardPage() {
  const [pendingDrivers, setPendingDrivers] = useState<DriverForAdmin[]>([]);
  const [allDrivers, setAllDrivers] = useState<DriverForAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const router = useRouter();

  const checkAuth = useCallback(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/login');
      return;
    }
  }, [router]);

  const loadData = useCallback(async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      setLoading(true);
      
      const [pending, all] = await Promise.all([
        getPendingDrivers(token),
        getAllDrivers(token)
      ]);
      
      setPendingDrivers(pending);
      setAllDrivers(all.drivers);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Възникна грешка';
      setError(errorMessage);
      if (errorMessage.includes('Invalid admin token')) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    checkAuth();
    loadData();
  }, [checkAuth, loadData]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    router.push('/login');
  };

  const handleViewDriver = (driverId: string) => {
    router.push(`/drivers/${driverId}`);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    
    const labels = {
      pending: 'Чака',
      approved: 'Одобрен',
      rejected: 'Отхвърлен'
    };

    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('bg-BG');
  };

  const currentDrivers = activeTab === 'pending' ? pendingDrivers : allDrivers;

  // Calculate statistics - deleted users are now excluded from allDrivers
  const bannedCount = allDrivers.filter(driver => driver.isBanned).length;
  const activeCount = allDrivers.filter(driver => !driver.isBanned).length;
  // Note: deletedCount can't be calculated since deleted users are filtered out
  
  // For deleted count, we could add a separate API call if needed
  // const deletedCount = await getDeletedUsersCount(token); // Future enhancement

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Администраторски панел
              </h1>
              <p className="text-gray-600">Управление на потребители и система</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Изход
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow cursor-pointer">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg font-medium">🚗</span>
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-medium text-gray-900">Управление на шофьори</h3>
                  <p className="text-sm text-gray-500">Одобрение, блокиране и управление на шофьорски акаунти</p>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-sm text-orange-600 font-medium">
                  Текуща страница - виж долу ↓
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push('/clients')}
            className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow cursor-pointer text-left"
          >
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg font-medium">👥</span>
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-medium text-gray-900">Управление на клиенти</h3>
                  <p className="text-sm text-gray-500">Преглед, блокиране и изтриване на клиентски акаунти</p>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-sm text-blue-600 font-medium">
                  Отиди към клиенти →
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">✓</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Активни шофьори
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {activeCount}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">⏳</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Чакащи одобрение
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {pendingDrivers.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">⚠</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Блокирани
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {bannedCount}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('pending')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'pending'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Чакащи одобрение ({pendingDrivers.length})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'all'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Всички шофьори ({allDrivers.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
              <p className="mt-2 text-gray-600">Зареждане...</p>
            </div>
          ) : currentDrivers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {activeTab === 'pending' ? 'Няма чакащи шофьори' : 'Няма шофьори'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {currentDrivers.map((driver) => (
                <li key={driver.id}>
                  <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className={`h-10 w-10 ${
                          driver.isBanned ? 'bg-red-500' : 'bg-orange-500'
                        } rounded-full flex items-center justify-center`}>
                          <span className="text-white font-medium">
                            {driver.fullName?.charAt(0) || '?'}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center flex-wrap gap-2">
                          <p className="text-sm font-medium text-gray-900">
                            {driver.fullName}
                            {driver.isBanned && (
                              <span className="ml-2 text-red-600 font-bold">(БЛОКИРАН)</span>
                            )}
                          </p>
                          <div className="ml-2">
                            {getStatusBadge(driver.verificationStatus)}
                          </div>
                          {/* Additional status badges */}
                          {driver.isBanned && (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              Блокиран
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {driver.email}
                        </p>
                        <p className="text-sm text-gray-500">
                          {driver.companyInfo?.name} | Булстат: {driver.companyInfo?.bulstat}
                        </p>
                        <p className="text-sm text-gray-500">
                          Регистриран: {formatDate(driver.createdAt)}
                        </p>
                        {/* Ban details */}
                        {driver.isBanned && driver.banReason && (
                          <p className="text-xs text-red-600 mt-1">
                            📛 Причина за блокиране: {driver.banReason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewDriver(driver.id)}
                        className="px-4 py-2 rounded-md text-sm font-medium bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        Преглед
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
} 