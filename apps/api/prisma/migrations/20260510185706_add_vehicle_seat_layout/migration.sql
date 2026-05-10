-- CreateEnum
CREATE TYPE "SeatCellType" AS ENUM ('SEAT', 'DRIVER', 'EMPTY', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('AVAILABLE', 'HELD', 'BOOKED', 'BLOCKED');

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "seatSelectionEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TripVehicle" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Main Vehicle',
    "vehicleType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "rows" INTEGER NOT NULL,
    "cols" INTEGER NOT NULL,
    "aisleAfterCol" INTEGER,
    "driverRow" INTEGER NOT NULL DEFAULT 0,
    "driverCol" INTEGER NOT NULL,
    "layout" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TripVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleSeat" (
    "id" TEXT NOT NULL,
    "tripVehicleId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "seatLabel" TEXT NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "status" "SeatStatus" NOT NULL DEFAULT 'AVAILABLE',
    "bookingId" TEXT,
    "travelerDetailId" TEXT,
    "heldAt" TIMESTAMP(3),
    "heldUntil" TIMESTAMP(3),
    "heldByUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VehicleSeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripVehicle_tripId_idx" ON "TripVehicle"("tripId");

-- CreateIndex
CREATE INDEX "TripVehicle_isDeleted_idx" ON "TripVehicle"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleSeat_travelerDetailId_key" ON "VehicleSeat"("travelerDetailId");

-- CreateIndex
CREATE INDEX "VehicleSeat_tripVehicleId_status_idx" ON "VehicleSeat"("tripVehicleId", "status");

-- CreateIndex
CREATE INDEX "VehicleSeat_bookingId_idx" ON "VehicleSeat"("bookingId");

-- CreateIndex
CREATE INDEX "VehicleSeat_status_heldUntil_idx" ON "VehicleSeat"("status", "heldUntil");

-- CreateIndex
CREATE INDEX "VehicleSeat_isDeleted_idx" ON "VehicleSeat"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleSeat_tripVehicleId_row_col_key" ON "VehicleSeat"("tripVehicleId", "row", "col");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleSeat_tripVehicleId_seatNumber_key" ON "VehicleSeat"("tripVehicleId", "seatNumber");

-- AddForeignKey
ALTER TABLE "TripVehicle" ADD CONSTRAINT "TripVehicle_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSeat" ADD CONSTRAINT "VehicleSeat_tripVehicleId_fkey" FOREIGN KEY ("tripVehicleId") REFERENCES "TripVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSeat" ADD CONSTRAINT "VehicleSeat_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSeat" ADD CONSTRAINT "VehicleSeat_travelerDetailId_fkey" FOREIGN KEY ("travelerDetailId") REFERENCES "TravelerDetail"("id") ON DELETE SET NULL ON UPDATE CASCADE;
