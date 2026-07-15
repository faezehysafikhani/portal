using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrgSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateLetterEntities2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "UserId",
                table: "LetterWorkflowSteps",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<string>(
                name: "UserName",
                table: "LetterWorkflowSteps",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Classification",
                table: "Letters",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "FolderName",
                table: "Letters",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FromUserName",
                table: "Letters",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasAttachment",
                table: "Letters",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "IncomingDate",
                table: "Letters",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IncomingFromOrg",
                table: "Letters",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IncomingNumber",
                table: "Letters",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LetterCounter",
                table: "Letters",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LetterDate",
                table: "Letters",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReferenceDate",
                table: "Letters",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReferenceType",
                table: "Letters",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RegistryId",
                table: "Letters",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "UserId",
                table: "LetterRecipients",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<string>(
                name: "ExternalName",
                table: "LetterRecipients",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalOrg",
                table: "LetterRecipients",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReferralText",
                table: "LetterRecipients",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReferralType",
                table: "LetterRecipients",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "UserName",
                table: "LetterRecipients",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UserName",
                table: "LetterWorkflowSteps");

            migrationBuilder.DropColumn(
                name: "Classification",
                table: "Letters");

            migrationBuilder.DropColumn(
                name: "FolderName",
                table: "Letters");

            migrationBuilder.DropColumn(
                name: "FromUserName",
                table: "Letters");

            migrationBuilder.DropColumn(
                name: "HasAttachment",
                table: "Letters");

            migrationBuilder.DropColumn(
                name: "IncomingDate",
                table: "Letters");

            migrationBuilder.DropColumn(
                name: "IncomingFromOrg",
                table: "Letters");

            migrationBuilder.DropColumn(
                name: "IncomingNumber",
                table: "Letters");

            migrationBuilder.DropColumn(
                name: "LetterCounter",
                table: "Letters");

            migrationBuilder.DropColumn(
                name: "LetterDate",
                table: "Letters");

            migrationBuilder.DropColumn(
                name: "ReferenceDate",
                table: "Letters");

            migrationBuilder.DropColumn(
                name: "ReferenceType",
                table: "Letters");

            migrationBuilder.DropColumn(
                name: "RegistryId",
                table: "Letters");

            migrationBuilder.DropColumn(
                name: "ExternalName",
                table: "LetterRecipients");

            migrationBuilder.DropColumn(
                name: "ExternalOrg",
                table: "LetterRecipients");

            migrationBuilder.DropColumn(
                name: "ReferralText",
                table: "LetterRecipients");

            migrationBuilder.DropColumn(
                name: "ReferralType",
                table: "LetterRecipients");

            migrationBuilder.DropColumn(
                name: "UserName",
                table: "LetterRecipients");

            migrationBuilder.AlterColumn<Guid>(
                name: "UserId",
                table: "LetterWorkflowSteps",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "UserId",
                table: "LetterRecipients",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);
        }
    }
}
