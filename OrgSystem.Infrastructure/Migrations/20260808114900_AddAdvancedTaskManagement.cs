using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrgSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAdvancedTaskManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AssigneeUserIdsJson",
                table: "Tasks",
                type: "text",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<DateTime>(
                name: "CompletionApprovedAt",
                table: "Tasks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CompletionApprovedByUserId",
                table: "Tasks",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CompletionRequestedAt",
                table: "Tasks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CompletionRequestedByUserId",
                table: "Tasks",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsCompletionApproved",
                table: "Tasks",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsRecurring",
                table: "Tasks",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ProjectIdsJson",
                table: "Tasks",
                type: "text",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<int>(
                name: "RecurrenceCount",
                table: "Tasks",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RecurrenceEndDate",
                table: "Tasks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RecurrenceInterval",
                table: "Tasks",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "RecurrenceSequence",
                table: "Tasks",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<Guid>(
                name: "RecurrenceSeriesId",
                table: "Tasks",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecurrenceType",
                table: "Tasks",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RecurrenceWeekday",
                table: "Tasks",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequiresCompletionApproval",
                table: "Tasks",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "TagsJson",
                table: "Tasks",
                type: "text",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.CreateTable(
                name: "TaskActivityLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TaskId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<string>(type: "text", nullable: false),
                    DetailsJson = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskActivityLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskActivityLogs_Tasks_TaskId",
                        column: x => x.TaskId,
                        principalTable: "Tasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TaskSavedViews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    FiltersJson = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskSavedViews", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TaskActivityLogs_TaskId_CreatedAt",
                table: "TaskActivityLogs",
                columns: new[] { "TaskId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TaskSavedViews_OwnerUserId_Name",
                table: "TaskSavedViews",
                columns: new[] { "OwnerUserId", "Name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TaskActivityLogs");

            migrationBuilder.DropTable(
                name: "TaskSavedViews");

            migrationBuilder.DropColumn(
                name: "AssigneeUserIdsJson",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "CompletionApprovedAt",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "CompletionApprovedByUserId",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "CompletionRequestedAt",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "CompletionRequestedByUserId",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "IsCompletionApproved",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "IsRecurring",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "ProjectIdsJson",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "RecurrenceCount",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "RecurrenceEndDate",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "RecurrenceInterval",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "RecurrenceSequence",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "RecurrenceSeriesId",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "RecurrenceType",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "RecurrenceWeekday",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "RequiresCompletionApproval",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "TagsJson",
                table: "Tasks");
        }
    }
}
