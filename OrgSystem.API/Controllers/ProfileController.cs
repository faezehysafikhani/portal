using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.Infrastructure.Persistence;
using System.Net.Mail;
using System.Text.RegularExpressions;

namespace OrgSystem.API.Controllers;

[ApiController,Route("api/v1/profile"),Authorize]
public class ProfileController(AppDbContext db):ControllerBase
{
    private Guid UserId=>Guid.Parse(User.FindFirst("user_id")!.Value);
    private static readonly Regex NamePattern=new(@"^[\p{L}\p{M}\s\u200C\-]+$",RegexOptions.Compiled);
    private static readonly Regex Dangerous=new(@"<[^>]+>|javascript\s*:|--|/\*|\*/|;\s*(select|insert|update|delete|drop|alter|exec)|\b(union\s+select|drop\s+table)",RegexOptions.IgnoreCase|RegexOptions.Compiled);
    private static string Digits(string? value)=>string.Concat((value??"").Trim().Select(c=>c switch{>='۰'and<='۹'=>(char)('0'+c-'۰'),>='٠'and<='٩'=>(char)('0'+c-'٠'),_=>c}));
    private static bool ValidImage(string? data,out string? error)
    {
        error=null;if(string.IsNullOrWhiteSpace(data)){error="تصویر انتخاب نشده است";return false;}
        if(!(data.StartsWith("data:image/png;base64,",StringComparison.OrdinalIgnoreCase)||data.StartsWith("data:image/jpeg;base64,",StringComparison.OrdinalIgnoreCase))){error="تصویر باید PNG یا JPEG باشد";return false;}
        byte[] bytes;try{bytes=Convert.FromBase64String(data[(data.IndexOf(',')+1)..]);}catch{error="محتوای تصویر معتبر نیست";return false;}
        if(bytes.Length>500*1024){error="حجم تصویر باید حداکثر ۵۰۰ کیلوبایت باشد";return false;}
        var png=bytes.Length>=4&&bytes[0]==0x89&&bytes[1]==0x50&&bytes[2]==0x4E&&bytes[3]==0x47;var jpg=bytes.Length>=3&&bytes[0]==0xFF&&bytes[1]==0xD8&&bytes[2]==0xFF;
        if(!png&&!jpg){error="فایل انتخابی تصویر معتبر نیست";return false;}return true;
    }
    private static object Dto(OrgSystem.Domain.Entities.Identity.User x)=>new{x.Id,x.Username,x.FullName,x.FirstName,x.LastName,x.Email,x.PhoneNumber,x.FixedPhone,x.Address,x.Department,x.Position,x.AvatarUrl,x.SignatureDataUrl,x.SignatureText};

    [HttpGet]
    public async Task<IActionResult> Get()=>await db.Users.AsNoTracking().FirstOrDefaultAsync(x=>x.Id==UserId)is{} user?Ok(Dto(user)):NotFound();

    [HttpPut]
    public async Task<IActionResult> Update(ProfileUpdateRequest request)
    {
        var fullName=request.FullName?.Trim()??"";if(fullName.Length is<2 or>150||!NamePattern.IsMatch(fullName))return BadRequest(new{message="نام و نام خانوادگی فقط باید شامل حروف باشد"});
        if(new[]{request.Email,request.Department,request.Position,request.Address}.Where(x=>x!=null).Any(x=>Dangerous.IsMatch(x!)))return BadRequest(new{message="ورود کد HTML، JavaScript یا SQL مجاز نیست"});
        if(!string.IsNullOrWhiteSpace(request.Email)){try{_=new MailAddress(request.Email);}catch{return BadRequest(new{message="ایمیل معتبر نیست"});}}
        var mobile=Digits(request.PhoneNumber);if(mobile.Length>0&&(mobile.Length is<10 or>15||!mobile.All(char.IsDigit)))return BadRequest(new{message="موبایل باید فقط عدد باشد"});
        var fixedPhone=Digits(request.FixedPhone);if(fixedPhone.Length>0&&(fixedPhone.Length is<7 or>15||!fixedPhone.All(char.IsDigit)))return BadRequest(new{message="تلفن ثابت باید فقط عدد باشد"});
        var parts=fullName.Split(' ',StringSplitOptions.RemoveEmptyEntries);var user=await db.Users.FirstOrDefaultAsync(x=>x.Id==UserId);if(user==null)return NotFound();
        user.FirstName=parts[0];user.LastName=string.Join(' ',parts.Skip(1));user.Email=request.Email?.Trim().ToLowerInvariant()??user.Email;user.PhoneNumber=mobile.Length>0?mobile:null;user.FixedPhone=fixedPhone.Length>0?fixedPhone:null;user.Department=request.Department?.Trim();user.Position=request.Position?.Trim();user.Address=request.Address?.Trim();await db.SaveChangesAsync();return Ok(Dto(user));
    }

    [HttpPut("avatar")]
    [RequestSizeLimit(1_500_000)]
    public async Task<IActionResult> Avatar(ImageRequest request){if(!ValidImage(request.ImageData,out var error))return BadRequest(new{message=error});var user=await db.Users.FirstOrDefaultAsync(x=>x.Id==UserId);if(user==null)return NotFound();user.AvatarUrl=request.ImageData;await db.SaveChangesAsync();return Ok(new{user.AvatarUrl});}

    [HttpPut("signature")]
    [RequestSizeLimit(1_500_000)]
    public async Task<IActionResult> Signature(SignatureRequest request){if(request.ImageData!=null&&!ValidImage(request.ImageData,out var error))return BadRequest(new{message=error});if(request.Text?.Length>500||request.Text!=null&&Dangerous.IsMatch(request.Text))return BadRequest(new{message="متن امضا معتبر نیست"});var user=await db.Users.FirstOrDefaultAsync(x=>x.Id==UserId);if(user==null)return NotFound();if(request.ImageData!=null)user.SignatureDataUrl=request.ImageData;user.SignatureText=request.Text?.Trim();await db.SaveChangesAsync();return Ok(Dto(user));}
}

public record ProfileUpdateRequest(string FullName,string? Email,string? PhoneNumber,string? FixedPhone,string? Department,string? Position,string? Address);
public record ImageRequest(string ImageData);
public record SignatureRequest(string? ImageData,string? Text);
