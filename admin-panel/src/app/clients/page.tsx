'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getAllClients, banClient, unbanClient, deleteClient, type ClientForAdmin } from '@/lib/adminAPI';

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientForAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const router = useRouter();

  const checkAuth = useCallback(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/login');
      return;
    }
  }, [router]);

  const loadClients = useCallback(async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      setLoading(true);
      const result = await getAllClients(token);
      setClients(result.clients);
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
    loadClients();
  }, [checkAuth, loadClients]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    router.push('/login');
  };

  const handleBackToDashboard = () => {
    router.push('/dashboard');
  };

  const handleBanClient = async (clientId: string, clientName: string) => {
    const reason = prompt(`Въведете причина за блокиране на ${clientName}:`);
    if (!reason) return;

    try {
      setActionLoading(clientId);
      const token = localStorage.getItem('adminToken');
      const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
      
      await banClient(clientId, adminUser.id, reason, token!);
      await loadClients(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при блокиране');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnbanClient = async (clientId: string, clientName: string) => {
    if (!confirm(`Сигурни ли сте, че искате да премахнете блокирането на ${clientName}?`)) return;

    try {
      setActionLoading(clientId);
      const token = localStorage.getItem('adminToken');
      const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
      
      await unbanClient(clientId, adminUser.id, token!);
      await loadClients(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при премахване на блокирането');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (!confirm(`ВНИМАНИЕ: Сигурни ли сте, че искате да изтриете акаунта на ${clientName}? Това действие е необратимо!`)) return;

    try {
      setActionLoading(clientId);
      const token = localStorage.getItem('adminToken');
      const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
      
      await deleteClient(clientId, adminUser.id, token!);
      await loadClients(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при изтриване');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('bg-BG');
  };

  // Calculate statistics
  const activeCount = clients.filter(client => !client.isBanned).length;
  const bannedCount = clients.filter(client => client.isBanned).length;
  const totalCount = clients.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToDashboard}
                className="text-orange-600 hover:text-orange-700 text-sm font-medium"
              >
                ← Назад към Dashboard
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Управление на клиенти
                </h1>
                <p className="text-gray-600">Преглед и управление на клиентски акаунти</p>
              </div>
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
            <button
              onClick={() => setError('')}
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
            >
              ×
            </button>
          </div>
        )}

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
                      Активни клиенти
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
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">⚠</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Блокирани клиенти
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {bannedCount}
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
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">#</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Общо клиенти
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {totalCount}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
              <p className="mt-2 text-gray-600">Зареждане на клиенти...</p>
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Няма регистрирани клиенти</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {clients.map((client) => (
                <li key={client.id}>
                  <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className={`h-10 w-10 ${
                          client.isBanned ? 'bg-red-500' : 'bg-blue-500'
                        } rounded-full flex items-center justify-center`}>
                          <span className="text-white font-medium">
                            {client.fullName?.charAt(0) || '?'}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center flex-wrap gap-2">
                          <p className="text-sm font-medium text-gray-900">
                            {client.fullName}
                            {client.isBanned && (
                              <span className="ml-2 text-red-600 font-bold">(БЛОКИРАН)</span>
                            )}
                          </p>
                          {/* Status badges */}
                          {client.isBanned && (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              Блокиран
                            </span>
                          )}
                          {client.phoneVerified && (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Верифициран телефон
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {client.email}
                        </p>
                        <p className="text-sm text-gray-500">
                          Телефон: {client.phone || 'Не е предоставен'}
                        </p>
                        <p className="text-sm text-gray-500">
                          Регистриран: {formatDate(client.createdAt)}
                        </p>
                        {client.totalOrders && (
                          <p className="text-sm text-gray-500">
                            Общо поръчки: {client.totalOrders}
                          </p>
                        )}
                        {client.averageRating && (
                          <p className="text-sm text-gray-500">
                            Рейтинг: {client.averageRating.toFixed(1)} ⭐
                          </p>
                        )}
                        {/* Ban details */}
                        {client.isBanned && client.banReason && (
                          <p className="text-xs text-red-600 mt-1">
                            📛 Причина за блокиране: {client.banReason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {client.isBanned ? (
                        <button
                          onClick={() => handleUnbanClient(client.id, client.fullName)}
                          disabled={actionLoading === client.id}
                          className="px-3 py-1 rounded-md text-sm font-medium bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                        >
                          {actionLoading === client.id ? 'Изчаква...' : 'Премахни бан'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBanClient(client.id, client.fullName)}
                          disabled={actionLoading === client.id}
                          className="px-3 py-1 rounded-md text-sm font-medium bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-50"
                        >
                          {actionLoading === client.id ? 'Изчаква...' : 'Блокирай'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteClient(client.id, client.fullName)}
                        disabled={actionLoading === client.id}
                        className="px-3 py-1 rounded-md text-sm font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                      >
                        {actionLoading === client.id ? 'Изчаква...' : 'Изтрий'}
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