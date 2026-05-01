import { Logger } from 'pino'
import type { CreateDestinationDto, UpdateDestinationDto } from '@shared/types/destination.types'
import { DestinationRepository } from '../repositories/destination.repository'
import { NotFoundError, ConflictError, ValidationError } from '../errors/app-error'
import { generateSlug } from '../utils/slug'

export class DestinationService {
  constructor(
    private destinationRepo: DestinationRepository,
    private logger: Logger,
  ) {}

  async list() {
    const destinations = await this.destinationRepo.findAll()
    return destinations.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      state: d.state,
      photoUrl: d.photoUrl,
      tripCount: d.tripCount,
      isPopular: d.isPopular,
    }))
  }

  async getById(id: string) {
    const destination = await this.destinationRepo.findById(id)
    if (!destination) throw new NotFoundError('Destination')
    return {
      id: destination.id,
      name: destination.name,
      slug: destination.slug,
      state: destination.state,
      photoUrl: destination.photoUrl,
      tripCount: destination.tripCount,
      isPopular: destination.isPopular,
    }
  }

  async create(input: CreateDestinationDto) {
    const slug = input.slug || generateSlug(input.name)

    const existing = await this.destinationRepo.findBySlug(slug)
    if (existing) throw new ConflictError(`Destination with slug "${slug}" already exists`)

    const destination = await this.destinationRepo.create({
      name: input.name,
      slug,
      state: input.state,
      photoUrl: input.photoUrl,
      isPopular: input.isPopular ?? false,
    })

    this.logger.info({ destinationId: destination.id, slug }, 'Destination created')
    return destination
  }

  async update(id: string, input: UpdateDestinationDto) {
    const existing = await this.destinationRepo.findById(id)
    if (!existing) throw new NotFoundError('Destination')

    if (input.slug && input.slug !== existing.slug) {
      const slugTaken = await this.destinationRepo.findBySlug(input.slug)
      if (slugTaken) throw new ConflictError(`Slug "${input.slug}" is already taken`)
    }

    const destination = await this.destinationRepo.update(id, input)
    this.logger.info({ destinationId: id }, 'Destination updated')
    return destination
  }

  async delete(id: string) {
    const existing = await this.destinationRepo.findById(id)
    if (!existing) throw new NotFoundError('Destination')

    if (existing.tripCount > 0) {
      throw new ValidationError('Cannot delete a destination with active trips. Remove or reassign trips first.')
    }

    await this.destinationRepo.softDelete(id)
    this.logger.info({ destinationId: id }, 'Destination soft-deleted')
  }
}
