#include <iostream>
#include <iomanip>
using namespace std;
int main(){
    int N;
    float h = 0, maior, menor = 100;
    cin >> N;
    for(int i = 0; i < N; i++){
        cin >> h;
        if(h < menor ){
            menor = h; }
        if(h > maior){
            maior = h;
            
        }
        
    }
    cout << fixed << setprecision(2);
    cout << "Menor altura: " << menor << endl;
    cout << "Maior altura: " << maior << endl; 
}