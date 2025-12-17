<script>
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase';
    import { fade, fly, scale } from 'svelte/transition';
    import { toast } from '$lib/stores/toast'; 
    import { jsPDF } from 'jspdf';
    import html2canvas from 'html2canvas';
    
    // Import des icônes
    import { 
        CalendarDays, Plus, Loader2, ChevronLeft, ChevronRight, Users, 
        Edit, Trash2, X, Save, Check, Ban, Cake, Download, FileText, Calendar
    } from 'lucide-svelte';
    
    // --- ÉTATS GLOBAUX ---
    let isLoading = true;
    let isSubmitting = false;
    let user = null;
    let leaveRequests = []; 
    let allProfiles = []; 
    let calendarContent;

    // --- ÉTATS DU FORMULAIRE ET MODALE ---
    let modalState = { isOpen: false, isEditing: false, leaveId: null };
    
    let currentLeave = { start_date: '', end_date: '', type: 'CN', reason: '' };

    const LEAVE_TYPES = [
        { value: 'CN', label: 'Congé Normal (CN)' },
        { value: 'JC', label: 'Jour de Compensation (JC)' },
        { value: 'ZM', label: 'Zone Maladie (ZM)' },
        { value: 'BT', label: 'Bons Temps (BT)' },
    ];
    
    const STATUS_MAP = {
        'APPROVED': 'Approuvée',
        'REJECTED': 'Refusée',
        'PENDING': 'En attente'
    };

    let confirmDeleteId = null; 

    // --- COULEURS ---
    const COLOR_CLASSES = [
        'bg-blue-600/80 border-blue-500/50 text-white shadow-blue-500/20', 
        'bg-green-600/80 border-green-500/50 text-white shadow-green-500/20', 
        'bg-purple-600/80 border-purple-500/50 text-white shadow-purple-500/20', 
        'bg-amber-500/80 border-amber-400/50 text-white shadow-amber-500/20',
        'bg-red-600/80 border-red-500/50 text-white shadow-red-500/20',
        'bg-pink-600/80 border-pink-500/50 text-white shadow-pink-500/20',
        'bg-cyan-600/80 border-cyan-500/50 text-white shadow-cyan-500/20',
        'bg-indigo-600/80 border-indigo-500/50 text-white shadow-indigo-500/20',
    ];

    const userColorMap = new Map();

    function getUserColor(userId) {
        if (!userColorMap.has(userId)) {
            let hash = 0;
            for (let i = 0; i < userId.length; i++) {
                hash = userId.charCodeAt(i) + ((hash << 5) - hash);
            }
            const colorIndex = Math.abs(hash) % COLOR_CLASSES.length;
            userColorMap.set(userId, COLOR_CLASSES[colorIndex]);
        }
        return userColorMap.get(userId);
    }

    // --- LOGIQUE CALENDRIER & DATE ---
    function getLeavesForDay(date) {
        const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        return leaveRequests.filter(req => {
            const start = new Date(req.start_date.replace(/-/g, '/'));
            const end = new Date(req.end_date.replace(/-/g, '/'));
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
            targetDay.setHours(0, 0, 0, 0);
            return targetDay >= start && targetDay <= end;
        });
    }

    function getBirthdaysForDay(dayDate) {
        const currentMonth = dayDate.getMonth();
        const currentDay = dayDate.getDate();
        return allProfiles
            .filter(p => {
                if (!p.birthday) return false;
                const bday = new Date(p.birthday.replace(/-/g, '/')); 
                return bday.getDate() === currentDay && bday.getMonth() === currentMonth;
            })
            .map(p => p.full_name);
    }

    let currentDate = new Date();
    currentDate.setDate(1); 
    $: displayedMonth = currentDate.getMonth();
    $: displayedYear = currentDate.getFullYear();
    let days = [];
    
    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    
    function getWeekNumber(d) {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }
    
    function generateCalendarDays(year, month) {
        const calendarDays = [];
        const date = new Date(year, month);
        const today = new Date();
        
        const getISOWeekday = (d) => (d.getDay() === 0 ? 7 : d.getDay());
        let startDayOfWeek = getISOWeekday(date);
        let day = new Date(date);
        day.setDate(day.getDate() - (startDayOfWeek - 1));

        let loops = 0;
        while (loops < 42 && (day.getMonth() !== month || loops < 7)) {
            const dayData = {
                date: new Date(day),
                dayOfMonth: day.getDate(),
                isCurrentMonth: day.getMonth() === month,
                isToday: day.toDateString() === today.toDateString(),
                weekNumber: getWeekNumber(day),
                isStartOfWeek: getISOWeekday(day) === 1,
                leaves: getLeavesForDay(day),
                birthdays: getBirthdaysForDay(day)
            };
            calendarDays.push(dayData);
            day.setDate(day.getDate() + 1);
            loops++;
        }
        
        while (calendarDays.length < 42) {
            const lastDayDate = calendarDays[calendarDays.length - 1].date; 
            const nextDay = new Date(lastDayDate);
            nextDay.setDate(nextDay.getDate() + 1);
            calendarDays.push({
                date: nextDay,
                dayOfMonth: nextDay.getDate(),
                isCurrentMonth: false,
                isToday: nextDay.toDateString() === today.toDateString(),
                weekNumber: getWeekNumber(nextDay),
                isStartOfWeek: getISOWeekday(nextDay) === 1,
                leaves: getLeavesForDay(nextDay),
                birthdays: getBirthdaysForDay(nextDay)
            });
        }
        return calendarDays;
    }
    
    function goToPreviousMonth() { currentDate = new Date(displayedYear, displayedMonth - 1, 1); }
    function goToNextMonth() { currentDate = new Date(displayedYear, displayedMonth + 1, 1); }

    $: days = generateCalendarDays(displayedYear, displayedMonth);

    // --- CRUD ---

    onMount(async () => {
        const { data: { user: sessionUser } } = await supabase.auth.getUser();
        user = sessionUser;
        await loadPlanningData();
        isLoading = false;
    });

    async function loadPlanningData() {
        const { data: leaves } = await supabase
            .from('leave_requests')
            .select(`id, user_id, start_date, end_date, type, status, reason, profiles(full_name)`)
            .order('start_date', { ascending: true });
        if (leaves) leaveRequests = leaves;
        
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, birthday');
        if (profiles) allProfiles = profiles;

        days = generateCalendarDays(displayedYear, displayedMonth);
    }

    function handleNewRequest() {
        currentLeave = { start_date: '', end_date: '', type: 'CN', reason: '' };
        modalState = { isOpen: true, isEditing: false, leaveId: null };
    }

    function handleEditRequest(leave) {
        currentLeave = {
            start_date: new Date(leave.start_date).toISOString().split('T')[0],
            end_date: new Date(leave.end_date).toISOString().split('T')[0],
            type: leave.type,
            reason: leave.reason || ''
        };
        modalState = { isOpen: true, isEditing: true, leaveId: leave.id };
    }
    
    function closeModal() { modalState = { isOpen: false, isEditing: false, leaveId: null }; }

    async function saveLeave() {
        if (!user || !currentLeave.start_date || !currentLeave.end_date) {
            toast.error("Dates requises."); 
            return;
        }
        
        isSubmitting = true;
        try {
            if (modalState.isEditing) {
                const { error } = await supabase.from('leave_requests').update({
                    start_date: currentLeave.start_date,
                    end_date: currentLeave.end_date,
                    type: currentLeave.type,
                    reason: currentLeave.reason,
                }).match({ id: modalState.leaveId, user_id: user.id }); 
                if (error) throw error;
                toast.success("Demande modifiée !");
            } else {
                const { error } = await supabase.from('leave_requests').insert({
                    user_id: user.id,
                    start_date: currentLeave.start_date,
                    end_date: currentLeave.end_date,
                    type: currentLeave.type,
                    reason: currentLeave.reason,
                    status: 'PENDING'
                });
                if (error) throw error;
                toast.success("Demande envoyée !");
            }
            await loadPlanningData(); 
            closeModal();
        } catch (e) {
            toast.error("Erreur: " + e.message); 
        } finally {
            isSubmitting = false;
        }
    }

    function initiateDelete(id) { confirmDeleteId = id; }
    function cancelDelete() { confirmDeleteId = null; }

    async function executeDelete(id) {
        confirmDeleteId = null;
        try {
            const { error } = await supabase.from('leave_requests').delete().match({ id: id, user_id: user.id }); 
            if (error) throw error;
            await loadPlanningData();
            toast.success("Supprimé."); 
        } catch (e) {
            toast.error("Erreur suppression."); 
        }
    }
    
    async function handleStatusChange(id, newStatus) {
        if (!user) return;
        try {
            const { error } = await supabase.from('leave_requests').update({ status: newStatus }).match({ id: id, user_id: user.id });
            if (error) throw error;
            leaveRequests = leaveRequests.map(req => req.id === id ? { ...req, status: newStatus } : req);
            days = generateCalendarDays(displayedYear, displayedMonth);
            toast.success("Statut mis à jour."); 
        } catch (e) {
            toast.error("Erreur màj statut."); 
        }
    }

    $: myLeaveRequests = leaveRequests.filter(req => user && req.user_id === user.id);

    function showLeaveDetails(day) {
        const leaves = day.leaves.map(l => `- ${l.profiles?.full_name || 'Inconnu'} : ${l.type} (${STATUS_MAP[l.status]})`).join('\n');
        const bdays = day.birthdays.length > 0 ? `\n🎂 Anniv: ${day.birthdays.join(', ')}` : '';
        if (leaves || bdays) toast.info(`Le ${day.date.toLocaleDateString('fr-FR')}:\n${leaves}${bdays}`, 5000); 
    }

    async function exportPlanningToPDF() {
        if (!calendarContent) return;
        const originalBg = calendarContent.style.backgroundColor;
        const originalClasses = calendarContent.className; 
        
        let tempClasses = originalClasses.replace(/\bshadow-[a-z0-9-]+\b/g, '')
                                         .replace(/\bdark:bg-[a-z0-9-]+\b/g, 'dark:bg-white')
                                         .replace(/\bbg-[a-z0-9-]+\/[a-z0-9-]+\b/g, '');
        
        calendarContent.className = tempClasses.trim() + ' bg-white text-black'; 
        calendarContent.style.backgroundColor = '#ffffff'; 
        
        try {
            const canvas = await html2canvas(calendarContent, { scale: 2, useCORS: true, logging: false });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', 'a4'); 
            const imgWidth = 280; 
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            pdf.setFontSize(16);
            pdf.text(`Planning - ${monthNames[displayedMonth]} ${displayedYear}`, 148.5, 15, { align: 'center' }); 
            pdf.addImage(imgData, 'PNG', 10, 20, imgWidth, imgHeight);
            pdf.save(`Planning_${monthNames[displayedMonth]}_${displayedYear}.pdf`);
        } catch (e) {
            toast.error("Erreur PDF.");
        } finally {
            calendarContent.style.backgroundColor = originalBg;
            calendarContent.className = originalClasses;
        }
    }

    // Styles Inputs
    const inputClass = "block w-full rounded-xl border-white/10 bg-black/40 p-3 text-sm font-medium text-white placeholder-gray-600 focus:border-blue-500/50 focus:ring-blue-500/50 transition-all outline-none";
</script>

<div class="container mx-auto p-4 md:p-8 space-y-8 min-h-screen">
    
    <header class="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-white/5 pb-6" in:fly={{ y: -20, duration: 600 }}>
        <div class="flex items-center gap-3">
            <div class="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                <CalendarDays size={32} />
            </div>
            <div>
                <h1 class="text-3xl font-bold text-gray-200 tracking-tight">Planning</h1>
                <p class="text-gray-500 text-sm mt-1">Gestion des congés et calendrier.</p>
            </div>
        </div>

        <div class="flex gap-3">
         <!--    <button 
                on:click={exportPlanningToPDF}
                class="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2"
                title="Exporter PDF"
            >
                <Download class="w-4 h-4" /> <span class="hidden sm:inline">PDF</span>
            </button> -->

            <button 
                on:click={handleNewRequest} 
                class="px-5 py-2 bg-green-600/80 hover:bg-green-500 text-white rounded-xl font-bold shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_20px_rgba(34,197,94,0.5)] border border-green-500/30 backdrop-blur-md transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
            >
                <Plus class="w-5 h-5" /> Nouvelle Demande
            </button>
        </div>
    </header>

    {#if isLoading}
        <div class="flex justify-center py-20"><Loader2 class="animate-spin w-10 h-10 text-blue-500/50" /></div>
    {:else}
        
        <div class="bg-black/20 border border-white/5 rounded-3xl p-6 shadow-sm" in:fly={{ y: 20, duration: 600, delay: 100 }}>
            <h2 class="text-lg font-bold text-gray-200 mb-6 flex items-center gap-2">
                <FileText class="w-5 h-5 text-blue-400" /> Mes Demandes
            </h2>
            
            <div class="space-y-3">
                {#each myLeaveRequests as request (request.id)}
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-2xl border transition-all hover:bg-white/5
                        {request.status === 'APPROVED' ? 'bg-green-500/5 border-green-500/20' : ''}
                        {request.status === 'REJECTED' ? 'bg-red-500/5 border-red-500/20' : ''}
                        {request.status === 'PENDING' ? 'bg-yellow-500/5 border-yellow-500/20' : ''}"
                    >
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border
                                {request.status === 'APPROVED' ? 'bg-green-500/20 text-green-400 border-green-500/30' : ''}
                                {request.status === 'REJECTED' ? 'bg-red-500/20 text-red-400 border-red-500/30' : ''}
                                {request.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : ''}">
                                {request.type}
                            </div>
                            <div>
                                <div class="text-sm font-bold text-gray-200">
                                    Du {new Date(request.start_date).toLocaleDateString('fr-FR')} 
                                    au {new Date(request.end_date).toLocaleDateString('fr-FR')}
                                </div>
                                <div class="text-xs font-medium uppercase tracking-wider mt-0.5
                                    {request.status === 'APPROVED' ? 'text-green-400' : ''}
                                    {request.status === 'REJECTED' ? 'text-red-400' : ''}
                                    {request.status === 'PENDING' ? 'text-yellow-400' : ''}">
                                    {STATUS_MAP[request.status]}
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 mt-3 sm:mt-0">
                            <div class="relative group">
                                <select 
                                    on:change={(e) => handleStatusChange(request.id, e.target.value)}
                                    class="appearance-none pl-3 pr-8 py-1.5 text-xs rounded-lg bg-black/30 border border-white/10 text-gray-300 focus:ring-1 focus:ring-blue-500 cursor-pointer outline-none hover:bg-white/5 transition-all"
                                    value={request.status}
                                >
                                    <option value="APPROVED" class="bg-gray-900">Approuvée</option>
                                    <option value="REJECTED" class="bg-gray-900">Refusée</option>
                                    <option value="PENDING" class="bg-gray-900">En attente</option>
                                </select>
                                <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <ChevronRight size={12} class="rotate-90" />
                                </div>
                            </div>

                            <div class="h-6 w-px bg-white/10 mx-1"></div>

                            <button on:click={() => handleEditRequest(request)} class="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 transition-all" title="Modifier">
                                <Edit class="w-4 h-4" />
                            </button>
                            
                            {#if confirmDeleteId === request.id}
                                <div class="flex items-center gap-1 bg-red-500/10 rounded-lg p-1 border border-red-500/20" transition:scale>
                                    <button on:click={() => executeDelete(request.id)} class="p-1 rounded text-red-400 hover:text-white hover:bg-red-500 transition-colors">
                                        <Check class="w-3.5 h-3.5" />
                                    </button>
                                    <button on:click={cancelDelete} class="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                                        <Ban class="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            {:else}
                                <button on:click={() => initiateDelete(request.id)} class="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all" title="Supprimer">
                                    <Trash2 class="w-4 h-4" />
                                </button>
                            {/if}
                        </div>
                    </div>
                {:else}
                    <div class="text-center py-8 text-gray-500 border border-dashed border-white/10 rounded-2xl bg-black/10">
                        Aucune demande enregistrée.
                    </div>
                {/each}
            </div>
        </div>

        <div class="bg-black/20 border border-white/5 rounded-3xl p-6 shadow-sm" in:fly={{ y: 20, duration: 600, delay: 200 }}>
            
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-lg font-bold text-gray-200 flex items-center gap-2">
                    <Users class="w-5 h-5 text-purple-400" /> Vue d'Équipe
                </h2>
                
                <div class="flex items-center gap-4 bg-black/30 border border-white/10 rounded-xl p-1">
                    <button on:click={goToPreviousMonth} class="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                        <ChevronLeft class="w-5 h-5" />
                    </button>
                    <span class="text-gray-200 font-bold text-sm min-w-[140px] text-center uppercase tracking-wide">
                        {monthNames[displayedMonth]} {displayedYear}
                    </span>
                    <button on:click={goToNextMonth} class="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                        <ChevronRight class="w-5 h-5" />
                    </button>
                </div>
            </div>
            
            <div class="planning-calendar-wrapper overflow-hidden rounded-2xl border border-white/10 shadow-inner bg-black/10" bind:this={calendarContent}>
                <div class="grid grid-cols-8 gap-px bg-white/5 text-center">
                    
                    <div class="py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-black/40">Sem</div> 
                    {#each dayNames as day}
                        <div class="py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-black/40">{day}</div>
                    {/each}

                    {#each days as day}
                        {#if day.isStartOfWeek}
                            <div class="row-span-1 flex items-center justify-center text-[10px] font-mono text-gray-600 bg-black/20 border-t border-white/5">
                                {day.weekNumber}
                            </div>
                        {/if}

                        <div
                            on:click={() => (day.leaves.length > 0 || day.birthdays.length > 0) && showLeaveDetails(day)}
                            class="min-h-[100px] relative p-1 transition-all border-t border-white/5
                                {day.isCurrentMonth ? 'bg-black/10 hover:bg-white/5' : 'bg-black/40 opacity-50'}
                                {day.isToday ? 'bg-blue-500/5 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]' : ''}
                                {(day.leaves.length > 0 || day.birthdays.length > 0) ? 'cursor-pointer' : ''}"
                        >
                            <span class="block text-right text-xs font-bold mb-1
                                {day.isToday ? 'text-blue-400' : 'text-gray-500'}">
                                {day.dayOfMonth}
                            </span>
                            
                            {#if day.birthdays.length > 0}
                                <span class="absolute top-1 left-1 text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]" title="Anniversaire(s)">
                                    <Cake class="w-3.5 h-3.5 fill-yellow-500/20" />
                                </span>
                            {/if}
                            
                            <div class="flex flex-col gap-1">
                                {#each day.leaves as leave, i (leave.id)}
                                    <div 
                                        class="h-1.5 w-full rounded-full transition-all duration-300 relative group
                                        {getUserColor(leave.user_id)} 
                                        {leave.status !== 'APPROVED' ? 'opacity-40 border border-white/10' : 'border border-white/20'}"
                                    >
                                        <div class="absolute bottom-2 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-gray-900 border border-white/10 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10 shadow-xl">
                                            {leave.profiles?.full_name} ({leave.type})
                                        </div>
                                    </div>
                                    {#if i < 3}
                                        <div class="text-[9px] leading-tight text-gray-400 truncate pl-1">
                                            {leave.profiles?.full_name.split(' ')[0]}
                                        </div>
                                    {/if}
                                {/each}
                                {#if day.leaves.length > 3}
                                    <div class="text-[9px] text-gray-600 text-center italic">+{day.leaves.length - 3} autres</div>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            </div> 
        </div>
    {/if}
</div>

{#if modalState.isOpen}
<div class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" transition:fade>
    <div 
        class="w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10 ring-1 ring-white/5 
        bg-gray-900/90 backdrop-blur-xl transition-all"
        transition:fly={{ y: 20, duration: 300 }}
    >
        <div class="flex justify-between items-center px-6 py-5 border-b border-white/10 bg-white/5">
            <h3 class="text-xl font-bold text-gray-100 flex items-center gap-2">
                <Calendar class="w-5 h-5 text-blue-400" />
                {modalState.isEditing ? 'Modifier Demande' : 'Nouvelle Demande'}
            </h3>
            <button on:click={closeModal} class="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
                <X class="w-5 h-5" />
            </button>
        </div>

        <form on:submit|preventDefault={saveLeave} class="p-6 space-y-5">
            
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label for="start_date" class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Début</label>
                    <input type="date" id="start_date" bind:value={currentLeave.start_date} required class="{inputClass} dark:[color-scheme:dark]">
                </div>
                <div>
                    <label for="end_date" class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Fin</label>
                    <input type="date" id="end_date" bind:value={currentLeave.end_date} required class="{inputClass} dark:[color-scheme:dark]">
                </div>
            </div>

            <div>
                <label for="leave_type" class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Type</label>
                <div class="relative">
                    <select id="leave_type" bind:value={currentLeave.type} class="{inputClass} appearance-none cursor-pointer">
                        {#each LEAVE_TYPES as type}
                            <option value={type.value} class="bg-gray-900">{type.label}</option>
                        {/each}
                    </select>
                    <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                        <ChevronRight size={16} class="rotate-90" />
                    </div>
                </div>
            </div>

            <div>
                <label for="reason" class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Motif (Optionnel)</label>
                <textarea id="reason" bind:value={currentLeave.reason} rows="3" class="{inputClass} resize-none" placeholder="Détails..."></textarea>
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-white/10 mt-2">
                <button type="button" on:click={closeModal} class="px-4 py-2 text-sm font-medium text-gray-400 border border-white/10 rounded-xl hover:bg-white/5 hover:text-white transition-all">
                    Annuler
                </button>
                <button type="submit" disabled={isSubmitting} class="px-4 py-2 text-sm font-bold text-white bg-blue-600/80 hover:bg-blue-500 border border-blue-500/30 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all flex items-center gap-2 disabled:opacity-50">
                    {#if isSubmitting}
                        <Loader2 class="w-4 h-4 animate-spin" />
                    {:else}
                        <Save class="w-4 h-4" /> Enregistrer
                    {/if}
                </button>
            </div>
        </form>
    </div>
</div>
{/if}