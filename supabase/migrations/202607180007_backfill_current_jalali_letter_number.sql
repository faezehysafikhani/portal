-- The only retained historical letter is tracking code 100.
-- Bring its legacy Gregorian-formatted number in line with the current Jalali format.
update public."Letters"
set "LetterNumber" = case "Type"
  when 0 then 'د/1405/04/27/001'
  when 1 then 'و/1405/04/27/001'
  else 'ص/1405/04/27/001'
end,
"UpdatedAt" = now()
where "IsDeleted" = false
  and "LetterCounter" = 100
  and "LetterNumber" like '%/2026/%';

