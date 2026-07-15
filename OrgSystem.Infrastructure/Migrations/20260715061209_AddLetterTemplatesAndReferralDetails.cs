using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrgSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLetterTemplatesAndReferralDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "LetterTemplateId",
                table: "Letters",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaperSize",
                table: "Letters",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "TemplateHasFooter",
                table: "Letters",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "TemplateHasHeader",
                table: "Letters",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "TemplateKey",
                table: "Letters",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecipientPosition",
                table: "LetterRecipients",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReferredByName",
                table: "LetterRecipients",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReferredByPosition",
                table: "LetterRecipients",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReferredByUserId",
                table: "LetterRecipients",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LetterTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TemplateKey = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PaperSize = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    HasHeader = table.Column<bool>(type: "bit", nullable: false),
                    HasFooter = table.Column<bool>(type: "bit", nullable: false),
                    ImageData = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LetterTemplates", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LetterTemplates_TenantId_TemplateKey",
                table: "LetterTemplates",
                columns: new[] { "TenantId", "TemplateKey" },
                unique: true);

            // Preserve useful information for referrals created before these
            // structured columns existed.
            migrationBuilder.Sql("""
                UPDATE r
                SET r.ReferredByUserId = w.UserId,
                    r.ReferredByName = w.UserName,
                    r.ReferredByPosition = actor.Position,
                    r.RecipientPosition = COALESCE(targetUser.Position, targetContact.JobTitle)
                FROM LetterRecipients r
                OUTER APPLY (
                    SELECT TOP (1) s.UserId, s.UserName
                    FROM LetterWorkflowSteps s
                    WHERE s.LetterId = r.LetterId AND s.Action = 4
                    ORDER BY ABS(DATEDIFF_BIG(MILLISECOND, s.CreatedAt, r.CreatedAt))
                ) w
                LEFT JOIN Users actor ON actor.Id = w.UserId
                LEFT JOIN Users targetUser ON targetUser.Id = r.UserId
                LEFT JOIN Contacts targetContact ON targetContact.Id = r.ContactId
                WHERE r.RecipientType = 2;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LetterTemplates");

            migrationBuilder.DropColumn(
                name: "LetterTemplateId",
                table: "Letters");

            migrationBuilder.DropColumn(
                name: "PaperSize",
                table: "Letters");

            migrationBuilder.DropColumn(
                name: "TemplateHasFooter",
                table: "Letters");

            migrationBuilder.DropColumn(
                name: "TemplateHasHeader",
                table: "Letters");

            migrationBuilder.DropColumn(
                name: "TemplateKey",
                table: "Letters");

            migrationBuilder.DropColumn(
                name: "RecipientPosition",
                table: "LetterRecipients");

            migrationBuilder.DropColumn(
                name: "ReferredByName",
                table: "LetterRecipients");

            migrationBuilder.DropColumn(
                name: "ReferredByPosition",
                table: "LetterRecipients");

            migrationBuilder.DropColumn(
                name: "ReferredByUserId",
                table: "LetterRecipients");
        }
    }
}
