#include <iostream>
#include <iomanip>
using namespace std;

int main()
{
    int tTreino,qAlunos=0, soma= 0, maior;
    double media;
    cin>> tTreino;
    maior=tTreino;
    while(tTreino!=0)
    {
         
        qAlunos++;
        soma= soma+tTreino;  
        cin>> tTreino; 
        
        
        
        if(tTreino>maior)
        {
            maior=tTreino;
        }
    }
    media=(soma*1.0)/(qAlunos*1.0);
    cout << "Maior tempo: " << maior << " minutos" << endl;
    cout << fixed << setprecision(2);
    cout << "Media dos tempos: " << media << " minutos" << endl;
    
    
    return 0;
}