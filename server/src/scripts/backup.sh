#!/bin/bash
#
# NurCake POS - PostgreSQL Auto Backup Script
# 
# Path: server/scripts/backup.sh
# 
# Script ini melakukan backup database PostgreSQL secara otomatis
# dengan dukungan untuk:
# - Daily backup dengan rotasi
# - Backup setelah sync sukses (triggered)
# - Kompresi untuk menghemat ruang
# - Cleanup backup lama
#
# INSTALASI:
# 1. chmod +x backup.sh
# 2. Setup cron: crontab -e
#    - Daily backup jam 2 pagi: 0 2 * * * /path/to/backup.sh daily
#    - Hourly backup: 0 * * * * /path/to/backup.sh hourly
#
# PENGGUNAAN:
# ./backup.sh [mode]
# Mode:
#   daily   - Backup harian dengan rotasi 30 hari
#   hourly  - Backup per jam dengan rotasi 24 jam
#   sync    - Backup setelah sync sukses (dipanggil oleh server)
#   manual  - Backup manual dengan timestamp penuh
#   restore - Restore dari backup tertentu
#

# ============================================================================
# CONFIGURATION
# ============================================================================

# Load environment variables if .env exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
fi

# Database configuration
DB_NAME="${DB_NAME:-nurcake_pos}"
DB_USER="${DB_USER:-izanm}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Backup configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/nurcake}"
LOG_DIR="${LOG_DIR:-/var/log/nurcake}"
LOG_FILE="${LOG_DIR}/backup.log"

# Retention periods (in days)
DAILY_RETENTION=30
HOURLY_RETENTION=1
SYNC_RETENTION=7

# Notification (optional - set NOTIFY_EMAIL in .env)
NOTIFY_EMAIL="${NOTIFY_EMAIL:-}"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

# Create required directories
init_directories() {
    mkdir -p "$BACKUP_DIR/daily"
    mkdir -p "$BACKUP_DIR/hourly"
    mkdir -p "$BACKUP_DIR/sync"
    mkdir -p "$BACKUP_DIR/manual"
    mkdir -p "$LOG_DIR"
}

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log_info() {
    log "INFO" "$1"
}

log_error() {
    log "ERROR" "$1"
}

log_success() {
    log "SUCCESS" "$1"
}

# Get database size
get_db_size() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" 2>/dev/null | tr -d ' '
}

# Get record counts
get_record_counts() {
    local counts=""
    counts+="Transaksi: $(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM transaksi WHERE deleted_at IS NULL;" 2>/dev/null | tr -d ' ')\n"
    counts+="Pesanan: $(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pesanan_kue WHERE deleted_at IS NULL;" 2>/dev/null | tr -d ' ')\n"
    counts+="Produk: $(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM produk WHERE deleted_at IS NULL;" 2>/dev/null | tr -d ' ')"
    echo -e "$counts"
}

# Send notification (if email configured)
send_notification() {
    local subject="$1"
    local message="$2"
    
    if [ -n "$NOTIFY_EMAIL" ] && command -v mail &> /dev/null; then
        echo -e "$message" | mail -s "$subject" "$NOTIFY_EMAIL"
    fi
}

# ============================================================================
# BACKUP FUNCTIONS
# ============================================================================

# Perform backup
do_backup() {
    local backup_type="$1"
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local date_only=$(date '+%Y%m%d')
    local hour_only=$(date '+%H')
    
    local backup_file=""
    local target_dir=""
    
    case "$backup_type" in
        daily)
            target_dir="$BACKUP_DIR/daily"
            backup_file="nurcake_daily_${date_only}.sql.gz"
            ;;
        hourly)
            target_dir="$BACKUP_DIR/hourly"
            backup_file="nurcake_hourly_${date_only}_${hour_only}.sql.gz"
            ;;
        sync)
            target_dir="$BACKUP_DIR/sync"
            backup_file="nurcake_sync_${timestamp}.sql.gz"
            ;;
        manual)
            target_dir="$BACKUP_DIR/manual"
            backup_file="nurcake_manual_${timestamp}.sql.gz"
            ;;
        *)
            log_error "Unknown backup type: $backup_type"
            return 1
            ;;
    esac
    
    local full_path="${target_dir}/${backup_file}"
    
    log_info "Starting $backup_type backup: $backup_file"
    log_info "Database: $DB_NAME, Host: $DB_HOST:$DB_PORT"
    
    # Check database connection
    if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
        log_error "Cannot connect to database"
        return 1
    fi
    
    # Get pre-backup stats
    local db_size=$(get_db_size)
    log_info "Database size: $db_size"
    
    # Perform backup with compression
    local start_time=$(date +%s)
    
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --format=plain \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        2>> "$LOG_FILE" | gzip > "$full_path"; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        local backup_size=$(du -h "$full_path" | cut -f1)
        
        log_success "Backup completed: $backup_file"
        log_info "Duration: ${duration}s, Size: $backup_size"
        
        # Log to database (if backup_log table exists)
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
            "INSERT INTO backup_log (backup_type, file_path, file_size, status, duration_seconds, created_at) 
             VALUES ('$backup_type', '$full_path', '$(stat -f%z "$full_path" 2>/dev/null || stat -c%s "$full_path")', 'success', $duration, NOW())
             ON CONFLICT DO NOTHING;" 2>/dev/null || true
        
        # Send success notification for daily backups
        if [ "$backup_type" = "daily" ]; then
            send_notification "[NurCake POS] Daily Backup Success" \
                "Daily backup completed successfully.\n\nFile: $backup_file\nSize: $backup_size\nDuration: ${duration}s\n\nRecord counts:\n$(get_record_counts)"
        fi
        
        return 0
    else
        log_error "Backup failed: $backup_file"
        
        # Remove failed backup file
        rm -f "$full_path"
        
        # Send failure notification
        send_notification "[NurCake POS] Backup FAILED" \
            "Backup failed!\n\nType: $backup_type\nTime: $(date)\n\nPlease check the logs at $LOG_FILE"
        
        return 1
    fi
}

# Cleanup old backups
do_cleanup() {
    local backup_type="$1"
    local retention_days="$2"
    local target_dir="${BACKUP_DIR}/${backup_type}"
    
    log_info "Cleaning up $backup_type backups older than $retention_days days"
    
    local deleted_count=0
    
    # Find and delete old backups
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            log_info "Deleting old backup: $(basename "$file")"
            rm -f "$file"
            ((deleted_count++))
        fi
    done < <(find "$target_dir" -name "*.sql.gz" -type f -mtime +$retention_days 2>/dev/null)
    
    if [ $deleted_count -gt 0 ]; then
        log_info "Deleted $deleted_count old $backup_type backup(s)"
    fi
}

# ============================================================================
# RESTORE FUNCTION
# ============================================================================

do_restore() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        echo "Usage: $0 restore <backup_file>"
        echo ""
        echo "Available backups:"
        echo ""
        echo "Daily backups:"
        ls -la "$BACKUP_DIR/daily/"*.sql.gz 2>/dev/null || echo "  (none)"
        echo ""
        echo "Hourly backups:"
        ls -la "$BACKUP_DIR/hourly/"*.sql.gz 2>/dev/null || echo "  (none)"
        echo ""
        echo "Sync backups:"
        ls -la "$BACKUP_DIR/sync/"*.sql.gz 2>/dev/null | tail -5 || echo "  (none)"
        echo ""
        echo "Manual backups:"
        ls -la "$BACKUP_DIR/manual/"*.sql.gz 2>/dev/null || echo "  (none)"
        return 1
    fi
    
    # Check if file exists
    if [ ! -f "$backup_file" ]; then
        # Try to find in backup directories
        for dir in daily hourly sync manual; do
            if [ -f "${BACKUP_DIR}/${dir}/${backup_file}" ]; then
                backup_file="${BACKUP_DIR}/${dir}/${backup_file}"
                break
            fi
        done
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    echo "========================================"
    echo "  NurCake POS - Database Restore"
    echo "========================================"
    echo ""
    echo "WARNING: This will REPLACE all data in the database!"
    echo ""
    echo "Backup file: $backup_file"
    echo "Database: $DB_NAME"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled."
        return 1
    fi
    
    # Create a backup before restore
    log_info "Creating pre-restore backup..."
    do_backup "manual"
    
    log_info "Starting restore from: $backup_file"
    
    local start_time=$(date +%s)
    
    # Restore
    if gunzip -c "$backup_file" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" 2>> "$LOG_FILE"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_success "Restore completed in ${duration}s"
        
        echo ""
        echo "Database restored successfully!"
        echo "Duration: ${duration}s"
        echo ""
        echo "Record counts after restore:"
        get_record_counts
        
        return 0
    else
        log_error "Restore failed!"
        echo ""
        echo "RESTORE FAILED! Check logs at $LOG_FILE"
        return 1
    fi
}

# ============================================================================
# STATUS/INFO FUNCTION
# ============================================================================

show_status() {
    echo "========================================"
    echo "  NurCake POS - Backup Status"
    echo "========================================"
    echo ""
    
    echo "Database: $DB_NAME @ $DB_HOST:$DB_PORT"
    echo "Size: $(get_db_size)"
    echo ""
    
    echo "Record counts:"
    get_record_counts
    echo ""
    
    echo "Backup directories:"
    echo "  Daily:  $(find "$BACKUP_DIR/daily" -name "*.sql.gz" 2>/dev/null | wc -l) backups"
    echo "  Hourly: $(find "$BACKUP_DIR/hourly" -name "*.sql.gz" 2>/dev/null | wc -l) backups"
    echo "  Sync:   $(find "$BACKUP_DIR/sync" -name "*.sql.gz" 2>/dev/null | wc -l) backups"
    echo "  Manual: $(find "$BACKUP_DIR/manual" -name "*.sql.gz" 2>/dev/null | wc -l) backups"
    echo ""
    
    echo "Latest backups:"
    echo "  Daily:  $(ls -t "$BACKUP_DIR/daily/"*.sql.gz 2>/dev/null | head -1 | xargs basename 2>/dev/null || echo 'none')"
    echo "  Hourly: $(ls -t "$BACKUP_DIR/hourly/"*.sql.gz 2>/dev/null | head -1 | xargs basename 2>/dev/null || echo 'none')"
    echo "  Sync:   $(ls -t "$BACKUP_DIR/sync/"*.sql.gz 2>/dev/null | head -1 | xargs basename 2>/dev/null || echo 'none')"
    echo ""
    
    echo "Disk usage:"
    du -sh "$BACKUP_DIR"/* 2>/dev/null || echo "  (no backups yet)"
    echo ""
    
    echo "Total backup size:"
    du -sh "$BACKUP_DIR" 2>/dev/null
}

# ============================================================================
# MAIN
# ============================================================================

# Initialize
init_directories

# Parse command
case "${1:-daily}" in
    daily)
        do_backup "daily"
        do_cleanup "daily" $DAILY_RETENTION
        do_cleanup "sync" $SYNC_RETENTION
        ;;
    hourly)
        do_backup "hourly"
        do_cleanup "hourly" $HOURLY_RETENTION
        ;;
    sync)
        do_backup "sync"
        do_cleanup "sync" $SYNC_RETENTION
        ;;
    manual)
        do_backup "manual"
        ;;
    restore)
        do_restore "$2"
        ;;
    status)
        show_status
        ;;
    cleanup)
        log_info "Running cleanup for all backup types"
        do_cleanup "daily" $DAILY_RETENTION
        do_cleanup "hourly" $HOURLY_RETENTION
        do_cleanup "sync" $SYNC_RETENTION
        ;;
    help|--help|-h)
        echo "NurCake POS - PostgreSQL Backup Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  daily   - Perform daily backup with 30-day retention (default)"
        echo "  hourly  - Perform hourly backup with 24-hour retention"
        echo "  sync    - Backup triggered after sync (7-day retention)"
        echo "  manual  - Manual backup (no auto-cleanup)"
        echo "  restore - Restore from a backup file"
        echo "  status  - Show backup status and statistics"
        echo "  cleanup - Run cleanup for all backup types"
        echo "  help    - Show this help message"
        echo ""
        echo "Configuration:"
        echo "  DB_NAME: $DB_NAME"
        echo "  DB_HOST: $DB_HOST:$DB_PORT"
        echo "  BACKUP_DIR: $BACKUP_DIR"
        echo ""
        echo "Cron setup examples:"
        echo "  # Daily backup at 2 AM"
        echo "  0 2 * * * ${SCRIPT_DIR}/backup.sh daily"
        echo ""
        echo "  # Hourly backup"
        echo "  0 * * * * ${SCRIPT_DIR}/backup.sh hourly"
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac