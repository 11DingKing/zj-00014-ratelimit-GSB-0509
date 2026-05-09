-- 日配额 Lua 脚本
-- KEYS[1] = 配额 key 前缀
-- ARGV[1] = 日配额限制
-- ARGV[2] = 请求权重
-- ARGV[3] = 当前时间戳(ms)
-- 返回: {1(允许)/0(拒绝), 剩余配额, 重置时间戳}

local key_prefix = KEYS[1]
local daily_limit = tonumber(ARGV[1])
local weight = tonumber(ARGV[2]) or 1
local current_ms = tonumber(ARGV[3])

-- 获取当前时间
local current_time = redis.call('TIME')
if not current_ms then
    current_ms = tonumber(current_time[1]) * 1000 + math.floor(tonumber(current_time[2]) / 1000)
end

-- 计算当前日期后缀(YYYY-MM-DD)
local current_date = os.date("!%Y-%m-%d", current_ms / 1000)

-- 生成当日的 key
local daily_key = key_prefix .. ":" .. current_date

-- 获取当日已使用配额
local used_quota = redis.call('GET', daily_key) or 0
used_quota = tonumber(used_quota)

-- 检查是否超过配额
if used_quota + weight > daily_limit then
    -- 超过配额，拒绝请求
    local remaining = daily_limit - used_quota
    
    -- 计算次日0点的时间戳
    local current_year = tonumber(os.date("!%Y", current_ms / 1000))
    local current_month = tonumber(os.date("!%m", current_ms / 1000))
    local current_day = tonumber(os.date("!%d", current_ms / 1000))
    
    -- 构造次日0点的时间戳
    local tomorrow_start = os.time({year = current_year, month = current_month, day = current_day + 1, hour = 0, min = 0, sec = 0})
    local reset_at = tomorrow_start * 1000
    
    return {0, remaining, reset_at}
else
    -- 在配额内，扣减配额
    local new_used = redis.call('INCRBY', daily_key, weight)
    
    -- 设置过期时间(2天，防止过期)
    redis.call('EXPIRE', daily_key, 60 * 24 * 2)
    
    local remaining = daily_limit - new_used
    
    -- 计算次日0点的时间戳
    local current_year = tonumber(os.date("!%Y", current_ms / 1000))
    local current_month = tonumber(os.date("!%m", current_ms / 1000))
    local current_day = tonumber(os.date("!%d", current_ms / 1000))
    
    local tomorrow_start = os.time({year = current_year, month = current_month, day = current_day + 1, hour = 0, min = 0, sec = 0})
    local reset_at = tomorrow_start * 1000
    
    return {1, remaining, reset_at}
end
