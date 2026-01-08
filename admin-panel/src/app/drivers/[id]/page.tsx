'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getDriverDetails, approveDriver, rejectDriver, banUser, unbanUser, deleteUser, type DriverForAdmin } from '@/lib/adminAPI';
import React from 'react';

export default function DriverDetailsPage() {
  // TEST LOG - DELETE AFTER CONFIRMING IT WORKS
  console.log('🔥 NEW CODE LOADED - Ban/Delete functions should be visible!');

  const [driver, setDriver] = useState<DriverForAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const router = useRouter();
  const params = useParams();
  const driverId = params.id as string;

  const checkAuth = useCallback(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/login');
      return;
    }
  }, [router]);

  const loadDriverDetails = useCallback(async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      setLoading(true);
      const driverData = await getDriverDetails(driverId, token);
      setDriver(driverData);
      
      // DEBUG: Log driver data to check ban/delete status
      console.log('🔍 Driver data loaded:', {
        isBanned: driverData.isBanned,
        isDeleted: driverData.isDeleted,
        bannedAt: driverData.bannedAt,
        banReason: driverData.banReason
      });
      
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
  }, [driverId, router]);

  useEffect(() => {
    checkAuth();
    loadDriverDetails();
  }, [checkAuth, loadDriverDetails]);

  const handleApprove = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
      if (!token || !adminUser.id) return;

      setActionLoading(true);
      await approveDriver(driverId, adminUser.id, token, approveNotes);
      
      // Reload driver data
      await loadDriverDetails();
      setApproveNotes('');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Възникна грешка';
      setError(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError('Моля въведете причина за отхвърляне');
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
      if (!token || !adminUser.id) return;

      setActionLoading(true);
      await rejectDriver(driverId, adminUser.id, token, rejectReason);
      
      // Reload driver data
      await loadDriverDetails();
      setShowRejectModal(false);
      setRejectReason('');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Възникна грешка';
      setError(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  // New ban/delete handler functions
  const handleBan = async () => {
    if (!banReason.trim()) {
      setError('Моля въведете причина за блокиране');
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
      if (!token || !adminUser.id) return;

      setActionLoading(true);
      await banUser(driverId, adminUser.id, banReason, token);
      
      await loadDriverDetails();
      setShowBanModal(false);
      setBanReason('');
      
      setError('Акаунтът е блокиран успешно');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Възникна грешка';
      setError(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnban = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
      if (!token || !adminUser.id) return;

      setActionLoading(true);
      await unbanUser(driverId, adminUser.id, token);
      
      await loadDriverDetails();
      setError('Блокировката е премахната успешно');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Възникна грешка';
      setError(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
      if (!token || !adminUser.id) return;

      setActionLoading(true);
      
      // Close modal immediately
      setShowDeleteModal(false);
      
      await deleteUser(driverId, adminUser.id, token);
      
      // Clear any loading states and errors before redirect
      setActionLoading(false);
      setError('');
      
      // Immediate redirect without any delay or additional operations
      router.replace('/dashboard'); // Use replace instead of push to prevent back navigation
      return; // Exit early to prevent any error handling
    } catch (err: unknown) {
      // Only show error if the deletion actually failed
      console.error('Delete operation failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Възникна грешка при изтриването';
      setError(errorMessage);
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    
    const labels = {
      pending: 'Чака одобрение',
      approved: 'Одобрен',
      rejected: 'Отхвърлен'
    };

    return (
      <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Няма данни';
    return new Date(date).toLocaleDateString('bg-BG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper function to render images (handles both base64 and URL images)
  const renderImage = (src: string, alt: string) => {
    // Debug: log the source to understand the format
    console.log(`Image source for ${alt}:`, src?.substring(0, 100));

    // Handle empty or null/undefined sources
    if (!src || src.trim() === '') {
      return (
        <div className="max-w-full rounded border p-4 bg-gray-50 border-gray-200" style={{ maxHeight: '300px', maxWidth: '100%' }}>
          <div className="text-center">
            <div className="text-gray-400 mb-2">📄</div>
            <p className="text-sm text-gray-600 font-medium">Няма документ</p>
            <p className="text-xs text-gray-500 mt-1">Не е качен документ</p>
          </div>
        </div>
      );
    }

    // Check if this is a Firebase Storage reference (short string with specific pattern)
    if (src.length < 100 && (
        src.includes('_AgwBNSKOlVPLFgbMpgrD3ZaSKez2') || 
        src.startsWith('roadside_cert_') || 
        src.startsWith('iaala_license_') || 
        src.startsWith('driver_photo_') ||
        /^[a-zA-Z_]+[A-Za-z0-9]{20,}$/.test(src)
      )) {
      return (
        <div className="max-w-full rounded border p-4 bg-blue-50 border-blue-200" style={{ maxHeight: '300px', maxWidth: '100%' }}>
          <div className="text-center">
            <div className="text-blue-600 mb-2">🔗</div>
            <p className="text-sm text-blue-700 font-medium">Firebase Storage Reference</p>
            <p className="text-xs text-blue-600 mt-1">
              Изображението е съхранено във Firebase Storage но не може да бъде заредено
            </p>
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer">Покажи reference ID</summary>
              <p className="text-xs text-gray-400 mt-1 font-mono break-all">{src}</p>
            </details>
            <div className="mt-2 text-xs text-orange-600">
              ⚠️ Необходимо е да се поправи Firebase Storage authentication
            </div>
          </div>
        </div>
      );
    }

    // Check if this is a local file path that browsers can't load
    if (src.startsWith('file://') || src.includes('/cache/') || src.includes('ExperienceData')) {
      return (
        <div className="max-w-full rounded border p-4 bg-yellow-50 border-yellow-200" style={{ maxHeight: '300px', maxWidth: '100%' }}>
          <div className="text-center">
            <div className="text-yellow-600 mb-2">📁</div>
            <p className="text-sm text-yellow-700 font-medium">Локален файл</p>
            <p className="text-xs text-yellow-600 mt-1">
              Файлът е запазен локално и не може да бъде показан в браузъра
            </p>
            <p className="text-xs text-gray-500 mt-2 font-mono truncate">
              {src.split('/').pop()}
            </p>
          </div>
        </div>
      );
    }

    // Check if this is a valid base64 string with proper prefix
    if (src.startsWith('data:image/')) {
      return (
        <img 
          src={src} 
          alt={alt}
          className="max-w-full h-auto rounded border object-contain"
          style={{ maxHeight: '300px', maxWidth: '100%' }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = '<div class="text-center p-4 bg-red-50 border border-red-200 rounded"><p class="text-sm text-red-700">❌ Грешка при зареждане на base64 изображението</p></div>';
            }
          }}
        />
      );
    }

    // Check if this might be a base64 string without the proper prefix
    // Base64 strings are usually long and contain only valid base64 characters
    if (src.length > 100 && /^[A-Za-z0-9+/]*={0,2}$/.test(src)) {
      // Try to display as base64 image (assume it's JPEG by default)
      const base64Src = `data:image/jpeg;base64,${src}`;
      return (
        <div>
          <img 
            src={base64Src} 
            alt={alt}
            className="max-w-full h-auto rounded border object-contain"
            style={{ maxHeight: '300px', maxWidth: '100%' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `
                  <div class="text-center p-4 bg-orange-50 border border-orange-200 rounded">
                    <div class="text-orange-600 mb-2">🔧</div>
                    <p class="text-sm text-orange-700 font-medium">Възможен base64 без prefix</p>
                    <p class="text-xs text-orange-600 mt-1">Опитахме да покажем като JPEG, но не успя</p>
                    <details class="mt-2">
                      <summary class="text-xs text-gray-500 cursor-pointer">Покажи детайли</summary>
                      <p class="text-xs text-gray-400 mt-1 font-mono break-all">${src.substring(0, 200)}...</p>
                    </details>
                  </div>
                `;
              }
            }}
          />
        </div>
      );
    }

    // Handle HTTP/HTTPS URLs
    if (src.startsWith('http://') || src.startsWith('https://')) {
      return (
        <img 
          src={src} 
          alt={alt}
          className="max-w-full h-auto rounded border object-contain"
          style={{ maxHeight: '300px', maxWidth: '100%' }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = '<div class="text-center p-4 bg-red-50 border border-red-200 rounded"><p class="text-sm text-red-700">❌ Грешка при зареждане на URL изображението</p></div>';
            }
          }}
        />
      );
    }

    // Unknown format - show details for debugging
    return (
      <div className="max-w-full rounded border p-4 bg-gray-50 border-gray-200" style={{ maxHeight: '300px', maxWidth: '100%' }}>
        <div className="text-center">
          <div className="text-gray-400 mb-2">❓</div>
          <p className="text-sm text-gray-600 font-medium">Неразпознат формат</p>
          <p className="text-xs text-gray-500 mt-1">
            Неподдържан формат на изображение
          </p>
          <details className="mt-2">
            <summary className="text-xs text-gray-500 cursor-pointer">Покажи детайли за debug</summary>
            <div className="mt-2 text-left">
              <p className="text-xs text-gray-400">Дължина: {src.length}</p>
              <p className="text-xs text-gray-400">Започва с: {src.substring(0, 20)}...</p>
              <p className="text-xs text-gray-400 font-mono break-all">{src.substring(0, 100)}{src.length > 100 ? '...' : ''}</p>
            </div>
          </details>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
          <p className="mt-2 text-gray-600">Зареждане...</p>
        </div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Шофьорът не е намерен</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md"
          >
            Назад към панела
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="mr-4 text-gray-600 hover:text-gray-900"
              >
                ← Назад
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {driver.fullName}
                </h1>
                <div className="mt-1">
                  {getStatusBadge(driver.verificationStatus)}
                </div>
              </div>
            </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Лична информация</h3>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Пълно име</dt>
                  <dd className="mt-1 text-sm text-gray-900">{driver.fullName}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Имейл</dt>
                  <dd className="mt-1 text-sm text-gray-900">{driver.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Телефон</dt>
                  <dd className="mt-1 text-sm text-gray-900">{driver.phone}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Телефон верифициран</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {driver.phoneVerified ? '✅ Да' : '❌ Не'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Дата на регистрация</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(driver.createdAt)}</dd>
                </div>
              </dl>
            </div>

            {/* Company Information */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Информация за фирмата</h3>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Име на фирмата</dt>
                  <dd className="mt-1 text-sm text-gray-900">{driver.companyInfo?.name || 'Няма данни'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Булстат</dt>
                  <dd className="mt-1 text-sm text-gray-900">{driver.companyInfo?.bulstat || 'Няма данни'}</dd>
                </div>
              </dl>
            </div>

            {/* Documents */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Документи</h3>
              <div className="space-y-6">
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-2">Сертификат за пътна помощ</dt>
                  {driver.documents?.roadsideAssistanceCert ? (
                    <div>
                      {renderImage(driver.documents.roadsideAssistanceCert, "Сертификат за пътна помощ")}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Няма качен документ</p>
                  )}
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-2">ИААЛА лиценз</dt>
                  {driver.documents?.iaalaLicense ? (
                    <div>
                      {renderImage(driver.documents.iaalaLicense, "ИААЛА лиценз")}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Няма качен документ</p>
                  )}
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-2">Снимка на шофьора</dt>
                  {driver.documents?.driverPhoto ? (
                    <div>
                      {renderImage(driver.documents.driverPhoto, "Снимка на шофьора")}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Няма качена снимка</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions Sidebar */}
          <div className="space-y-6">
            {/* Verification Status */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Статус на верификация</h3>
              <div className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Текущ статус</dt>
                  <dd className="mt-1">{getStatusBadge(driver.verificationStatus)}</dd>
                </div>
                
                {driver.verificationDate && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Дата на верификация</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(driver.verificationDate)}</dd>
                  </div>
                )}
                
                {driver.verifiedBy && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Верифициран от</dt>
                    <dd className="mt-1 text-sm text-gray-900">{driver.verifiedBy}</dd>
                  </div>
                )}
                
                {driver.verificationNotes && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Бележки</dt>
                    <dd className="mt-1 text-sm text-gray-900">{driver.verificationNotes}</dd>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {driver.verificationStatus === 'pending' && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Действия</h3>
                
                {/* Approve Section */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Бележки за одобрение (опционално)
                    </label>
                    <textarea
                      value={approveNotes}
                      onChange={(e) => setApproveNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                      rows={3}
                      placeholder="Добавете бележки..."
                    />
                  </div>
                  
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50"
                  >
                    {actionLoading ? 'Обработва...' : '✅ Одобри шофьора'}
                  </button>
                  
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={actionLoading}
                    className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50"
                  >
                    ❌ Отхвърли шофьора
                  </button>
                </div>
              </div>
            )}

            {/* Administrative Actions */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Административни действия</h3>
              
              {/* Ban/Unban Actions */}
              <div className="space-y-3">
                {(() => {
                  console.log('🎯 Administrative Actions section rendering...');
                  console.log('🔍 Driver ban/delete status:', {
                    isBanned: driver.isBanned,
                    isDeleted: driver.isDeleted
                  });
                  return null;
                })()}
                
                {!driver.isBanned ? (
                  <button
                    onClick={() => {
                      console.log('🟡 BAN button clicked');
                      setShowBanModal(true);
                    }}
                    disabled={actionLoading}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50"
                  >
                    ⚠️ Блокирай акаунт
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      console.log('🟢 UNBAN button clicked');
                      handleUnban();
                    }}
                    disabled={actionLoading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50"
                  >
                    ✅ Премахни блокировка
                  </button>
                )}
                
                {!driver.isDeleted && (
                  <button
                    onClick={() => {
                      console.log('🔴 DELETE button clicked');
                      setShowDeleteModal(true);
                    }}
                    disabled={actionLoading}
                    className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50"
                  >
                    🗑️ Изтрий акаунт
                  </button>
                )}

                {/* Ban Status Display */}
                {driver.isBanned && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-sm text-yellow-800">
                      <strong>Блокиран на:</strong> {formatDate(driver.bannedAt || null)}
                    </p>
                    <p className="text-sm text-yellow-800">
                      <strong>Причина:</strong> {driver.banReason}
                    </p>
                    {driver.bannedBy && (
                      <p className="text-sm text-yellow-800">
                        <strong>Блокирал:</strong> {driver.bannedBy}
                      </p>
                    )}
                  </div>
                )}

                {/* Deleted Status Display */}
                {driver.isDeleted && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm text-red-800">
                      <strong>Изтрит на:</strong> {formatDate(driver.deletedAt || null)}
                    </p>
                    {driver.deletedBy && (
                      <p className="text-sm text-red-800">
                        <strong>Изтрил:</strong> {driver.deletedBy}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Отхвърляне на шофьор
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Причина за отхвърляне *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                  rows={4}
                  placeholder="Въведете причината за отхвърляне..."
                  required
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleReject}
                  disabled={actionLoading || !rejectReason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50"
                >
                  {actionLoading ? 'Обработва...' : 'Отхвърли'}
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                  }}
                  disabled={actionLoading}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md font-medium disabled:opacity-50"
                >
                  Отказ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ban Modal */}
      {showBanModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Блокиране на акаунт
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Причина за блокиране *
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                rows={4}
                placeholder="Въведете причината..."
                required
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleBan}
                disabled={!banReason.trim() || actionLoading}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50"
              >
                {actionLoading ? 'Блокира...' : 'Блокирай'}
              </button>
              <button
                onClick={() => {
                  setShowBanModal(false);
                  setBanReason('');
                }}
                disabled={actionLoading}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md font-medium disabled:opacity-50"
              >
                Отказ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              ⚠️ Изтриване на акаунт
            </h3>
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-800">
                <strong>Внимание!</strong> Това действие е необратимо.
                Личните данни ще бъдат анонимизирани.
              </p>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              Сигурни ли сте, че искате да изтриете акаунта на {driver?.fullName}?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50"
              >
                {actionLoading ? 'Изтрива...' : 'Да, изтрий'}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={actionLoading}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md font-medium disabled:opacity-50"
              >
                Отказ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 