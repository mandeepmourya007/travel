'use client'

import { useState } from 'react'
import { Tags, Plus, Pencil, Trash2, Check, X, Clock, CheckCircle, XCircle } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableContainer,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { Pagination } from '@/components/shared/pagination'
import {
  useAdminTripCategories,
  useCreateTripCategory,
  useUpdateTripCategory,
  useDeleteTripCategory,
  useAdminTripTypeRequests,
  useReviewTripTypeRequest,
} from '@/hooks/use-trip-categories'
import { cn } from '@/lib/utils'
import type { AdminTripCategoryItem } from '@shared/types/trip-category.types'

type TabValue = 'categories' | 'requests'

export default function AdminTripTypesPage() {
  const [tab, setTab] = useState<TabValue>('categories')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Tags className="h-7 w-7 text-primary-600" />
        <h1 className="font-display text-2xl font-bold text-neutral-900">Trip Types</h1>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'categories' && <CategoriesTab />}
      {tab === 'requests' && <RequestsTab />}
    </div>
  )
}

// ─── Categories Tab ──────────────────────────────────────

function CategoriesTab() {
  const { data, isLoading, error, refetch } = useAdminTripCategories()
  const createMutation = useCreateTripCategory()
  const updateMutation = useUpdateTripCategory()
  const deleteMutation = useDeleteTripCategory()

  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Create form state
  const [newValue, setNewValue] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newOrder, setNewOrder] = useState('')

  // Edit form state
  const [editLabel, setEditLabel] = useState('')
  const [editOrder, setEditOrder] = useState('')
  const [editActive, setEditActive] = useState(true)

  const resetCreate = () => {
    setNewValue('')
    setNewLabel('')
    setNewOrder('')
    setShowCreate(false)
  }

  const handleCreate = async () => {
    if (!newValue.trim() || !newLabel.trim()) return
    await createMutation.mutateAsync({
      value: newValue.trim().toUpperCase().replace(/\s+/g, '_'),
      label: newLabel.trim(),
      sortOrder: newOrder ? parseInt(newOrder, 10) : undefined,
    })
    resetCreate()
  }

  const startEdit = (cat: AdminTripCategoryItem) => {
    setEditingId(cat.id)
    setEditLabel(cat.label)
    setEditOrder(String(cat.sortOrder))
    setEditActive(cat.isActive)
  }

  const handleUpdate = async () => {
    if (!editingId || !editLabel.trim()) return
    await updateMutation.mutateAsync({
      id: editingId,
      data: {
        label: editLabel.trim(),
        sortOrder: editOrder ? parseInt(editOrder, 10) : undefined,
        isActive: editActive,
      },
    })
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-12 rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) return <ErrorState onRetry={refetch} />
  if (!data?.length) return <EmptyState message="No trip categories found." />

  return (
    <div className="space-y-4">
      {/* Create button / form */}
      {showCreate ? (
        <div className="rounded-lg border border-primary-200 bg-primary-50 p-4">
          <p className="text-sm font-semibold text-neutral-700 mb-3">New Category</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Value (e.g. CAMPING)"
              className="input text-sm"
            />
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (e.g. Camping)"
              className="input text-sm"
            />
            <input
              value={newOrder}
              onChange={(e) => setNewOrder(e.target.value)}
              placeholder="Sort order"
              type="number"
              className="input text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending || !newValue.trim() || !newLabel.trim()}
                className="btn-primary text-sm flex-1"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
              <button onClick={resetCreate} className="btn-outline text-sm">
                Cancel
              </button>
            </div>
          </div>
          {createMutation.isError && (
            <p className="mt-2 text-xs text-error-500">
              {(createMutation.error as Error)?.message || 'Failed to create'}
            </p>
          )}
        </div>
      ) : (
        <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center text-sm gap-2">
          <Plus className="h-4 w-4" />
          <span>Add Category</span>
        </button>
      )}

      {/* Table — desktop */}
      <TableContainer className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Value</TableHead>
              <TableHead>Label</TableHead>
              <TableHead className="text-center">Order</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Trips</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((cat) => (
              <TableRow key={cat.id}>
                {editingId === cat.id ? (
                  <>
                    <TableCell>
                      <code className="text-xs bg-neutral-100 px-1.5 py-0.5 rounded">{cat.value}</code>
                    </TableCell>
                    <TableCell>
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="input text-sm w-full"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <input
                        value={editOrder}
                        onChange={(e) => setEditOrder(e.target.value)}
                        type="number"
                        className="input text-sm w-16 text-center mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => setEditActive(!editActive)}
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                          editActive
                            ? 'bg-success-50 text-success-700'
                            : 'bg-neutral-100 text-neutral-500',
                        )}
                      >
                        {editActive ? 'Active' : 'Inactive'}
                      </button>
                    </TableCell>
                    <TableCell className="text-center text-sm text-neutral-500">{cat.tripCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={handleUpdate}
                          disabled={updateMutation.isPending}
                          className="p-1.5 rounded-md text-success-600 hover:bg-success-50 transition-colors"
                          title="Save"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 transition-colors"
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>
                      <code className="text-xs bg-neutral-100 px-1.5 py-0.5 rounded">{cat.value}</code>
                    </TableCell>
                    <TableCell className="font-medium text-neutral-800">{cat.label}</TableCell>
                    <TableCell className="text-center text-sm text-neutral-500">{cat.sortOrder}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={cat.isActive ? 'default' : 'secondary'}>
                        {cat.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm text-neutral-500">{cat.tripCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => startEdit(cat)}
                          className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {cat.tripCount > 0 ? (
                          <button
                            disabled
                            className="p-1.5 rounded-md text-neutral-300 cursor-not-allowed"
                            title="Cannot delete — trips exist"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                disabled={deleteMutation.isPending}
                                className="p-1.5 rounded-md text-error-500 hover:bg-error-50 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete category</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Delete &quot;{cat.label}&quot;? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(cat.id)}
                                  className="bg-error-500 hover:bg-error-600 text-white"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Cards — mobile */}
      <div className="space-y-3 sm:hidden">
        {data.map((cat) => (
          <div key={cat.id} className="rounded-lg border border-neutral-200 bg-white p-4">
            {editingId === cat.id ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-neutral-500">Editing: {cat.value}</p>
                <input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="Label"
                  className="input text-sm"
                />
                <div className="flex gap-3">
                  <input
                    value={editOrder}
                    onChange={(e) => setEditOrder(e.target.value)}
                    type="number"
                    placeholder="Order"
                    className="input text-sm w-20"
                  />
                  <button
                    onClick={() => setEditActive(!editActive)}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                      editActive
                        ? 'bg-success-50 text-success-500'
                        : 'bg-neutral-100 text-neutral-500',
                    )}
                  >
                    {editActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdate}
                    disabled={updateMutation.isPending}
                    className="btn-primary text-xs flex-1"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn-outline text-xs flex-1">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">{cat.label}</p>
                    <code className="text-xs text-neutral-500">{cat.value}</code>
                  </div>
                  <Badge variant={cat.isActive ? 'default' : 'secondary'}>
                    {cat.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                  <span>Order: {cat.sortOrder}</span>
                  <span>{cat.tripCount} trips</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => startEdit(cat)} className="btn-outline text-xs flex-1 gap-1">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  {cat.tripCount > 0 ? (
                    <button
                      disabled
                      className="btn-outline text-xs flex-1 gap-1 opacity-40 cursor-not-allowed"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="btn-outline text-xs flex-1 gap-1 text-error-500 border-error-200">
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete category</AlertDialogTitle>
                          <AlertDialogDescription>
                            Delete &quot;{cat.label}&quot;? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(cat.id)}
                            className="bg-error-500 hover:bg-error-600 text-white"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Requests Tab ────────────────────────────────────────

const REQUEST_STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

const REQUESTS_PER_PAGE = 10

function RequestsTab() {
  const [statusTab, setStatusTab] = useState('PENDING')
  const [page, setPage] = useState(1)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState('')

  const filters = {
    status: statusTab === 'all' ? undefined : statusTab,
    page,
    limit: REQUESTS_PER_PAGE,
  }
  const { data, isLoading, error, refetch } = useAdminTripTypeRequests(filters)
  const reviewMutation = useReviewTripTypeRequest()

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await reviewMutation.mutateAsync({
      id,
      data: { status, adminNote: adminNote.trim() || undefined },
    })
    setReviewingId(null)
    setAdminNote('')
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) return <ErrorState onRetry={refetch} />

  const requests = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {REQUEST_STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => { setStatusTab(t.value); setPage(1) }}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              statusTab === t.value
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <EmptyState message="No requests found." />
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-800">
                    &quot;{req.suggestedName}&quot;
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    by {req.organizer.businessName}
                  </p>
                  <p className="text-xs text-neutral-600 mt-1">{req.reason}</p>
                </div>
                <StatusBadge status={req.status} />
              </div>

              {req.adminNote && (
                <p className="text-xs text-neutral-500 bg-neutral-50 rounded p-2">
                  Admin: {req.adminNote}
                </p>
              )}

              {req.status === 'PENDING' && (
                <>
                  {reviewingId === req.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        placeholder="Admin note (optional)"
                        rows={2}
                        className="input text-sm w-full resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview(req.id, 'APPROVED')}
                          disabled={reviewMutation.isPending}
                          className="btn-primary text-xs flex-1 gap-1"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          {reviewMutation.isPending ? 'Saving...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReview(req.id, 'REJECTED')}
                          disabled={reviewMutation.isPending}
                          className="btn-outline text-xs flex-1 gap-1 text-error-600 border-error-200 hover:bg-error-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </button>
                        <button
                          onClick={() => { setReviewingId(null); setAdminNote('') }}
                          className="btn-outline text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReviewingId(req.id)}
                      className="btn-outline text-xs gap-1"
                    >
                      Review
                    </button>
                  )}
                </>
              )}

              <p className="text-xs text-neutral-400">
                {new Date(req.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          ))}

          {pagination && pagination.totalPages > 1 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: typeof Clock; className: string; label: string }> = {
    PENDING: { icon: Clock, className: 'bg-warning-50 text-warning-500', label: 'Pending' },
    APPROVED: { icon: CheckCircle, className: 'bg-success-50 text-success-500', label: 'Approved' },
    REJECTED: { icon: XCircle, className: 'bg-error-50 text-error-500', label: 'Rejected' },
  }
  const c = config[status] ?? config.PENDING
  const Icon = c.icon

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', c.className)}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  )
}
