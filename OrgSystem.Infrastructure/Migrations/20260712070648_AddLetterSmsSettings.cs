using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrgSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLetterSmsSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ContactId",
                table: "LetterRecipients",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhoneNumber",
                table: "LetterRecipients",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "SmsRequested",
                table: "LetterRecipients",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SmsStatus",
                table: "LetterRecipients",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SmsProviderSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProviderName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ApiUrl = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SenderNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    EncryptedApiKey = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    LetterTemplate = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ReferralTemplate = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MeetingTemplate = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SmsProviderSettings", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SmsProviderSettings");

            migrationBuilder.DropColumn(
                name: "ContactId",
                table: "LetterRecipients");

            migrationBuilder.DropColumn(
                name: "PhoneNumber",
                table: "LetterRecipients");

            migrationBuilder.DropColumn(
                name: "SmsRequested",
                table: "LetterRecipients");

            migrationBuilder.DropColumn(
                name: "SmsStatus",
                table: "LetterRecipients");
        }
    }
}
