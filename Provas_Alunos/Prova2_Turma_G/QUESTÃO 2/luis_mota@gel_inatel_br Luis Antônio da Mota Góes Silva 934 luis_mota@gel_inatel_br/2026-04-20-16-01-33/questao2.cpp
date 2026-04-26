#include <iostream> 
#include <iomanip>
using namespace std;

int main(){
    int N;
    float num;
    float soma = 0;
    int quantidade = 0;
    
    cin >> N;
    
    for(int i = 0; i < N; i++){
        cin >> num;
        soma += num;
        quantidade++;
    }
    
    cout << fixed << setprecision(4) << soma / quantidade << endl;
    
    return 0;
}