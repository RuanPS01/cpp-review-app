#include <iostream>
#include <iomanip>

using namespace std;

int main(){
    int tempo;
    int soma;
    double media;
    int i = 0; 
    
    cin >> tempo;
    while(tempo !=0){
        i++;
        soma = soma + tempo;
    }
    media = soma / i;
    cout << fixed << setprecision(2) << "Media dos tempos: " << media << " minutos"; 
    
    return 0;
}